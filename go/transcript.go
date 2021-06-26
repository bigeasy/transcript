package transcript

import (
    "bytes"
    "errors"
    "os"
    "fmt"
    "encoding/json"
)

type ChecksumFunc func([]byte) int

type Recorder struct {
    checksum ChecksumFunc
}

func NewRecorder (checksum ChecksumFunc) *Recorder {
    return &Recorder{checksum}
}

func (recorder *Recorder) Record (keys []string, blocks [][][]byte) []byte {
    // TODO allocate necessary length only
    sums := [][]int{}
    var checksums []int
    var bodies [][]byte
    for _, block := range blocks {
        lengths := []int{}
        lines := [][]byte{}
        for _, part := range block {
            line := make([]byte, len(part) + 1)
            copy(line, part)
            line[len(part)] = 0xa
            lengths = append(lengths, len(part) + 1)
            lines = append(lines, line)
        }
        sums = append(sums, lengths)
        var body []byte
        for _, line := range lines {
            body = append(body, line...)
        }
        checksums = append(checksums, recorder.checksum(body))
        bodies = append(bodies, body)
    }
    var buffer []byte
    jc, _ := json.Marshal(checksums)
    buffer = append(buffer, jc...)
    buffer = append(buffer, 0xa)
    jl, _ := json.Marshal(sums)
    buffer = append(buffer, jl...)
    buffer = append(buffer, 0xa)
    for _, body := range bodies {
        buffer = append(buffer, body...)
    }
    fmt.Fprintf(os.Stdout, "hello %s, %d, %d, %d\n", string(buffer), cap(bodies), len(sums[0]), sums[0][0])
    return buffer
}

type Player struct {
    checksum ChecksumFunc
    state string
    length int
    remainder []byte
    lengths [][]float64
    checksums []float64
    parts [][]byte
}

func NewPlayer (checksum ChecksumFunc) *Player {
    return &Player{checksum, "checksum", 0, nil, nil, nil, nil}
}

type Chunk struct {
    parts [][]byte
    sizes []int
    sipped []int
}

func (p *Player) Split (chunk []byte, sip int) ([]Chunk, error) {
    var sizes []int
    var chunks []Chunk
    var sipped []int
    checksums := p.checksums
    lengths := p.lengths
    parts := p.parts
    SPLIT: for {
        switch p.state {
        case "checksum": {
                i := bytes.IndexByte(chunk, 0xa)
                if i == -1 {
                    break SPLIT
                }
                sizes = append(sizes, i + 1)
                json.Unmarshal(chunk[0:i], &checksums)
                chunk = chunk[i + 1:]
                fmt.Fprintf(os.Stdout, "here %f \n", checksums[0])
                p.state = "lengths"
            }
        case "lengths": {
                i := bytes.IndexByte(chunk, 0xa)
                if i == -1 {
                    break SPLIT
                }
                sizes = append(sizes, i + 1)
                sipped = make([]int, len(sizes))
                copy(sipped, sizes)
                checksum := p.checksum(chunk[0:i])
                if int(checksums[0]) != checksum {
                    return []Chunk{}, errors.New("lengths checksum failure")
                }
                json.Unmarshal(chunk[0:i], &lengths)
                chunk = chunk[i + 1:]
                for _, block := range lengths {
                    for _, length := range block {
                        sizes = append(sizes, int(length))
                    }
                }
                p.state = "block"
                fmt.Fprintf(os.Stdout, "sipped %d %s %d %d %d\n", i, string(chunk), len(sipped), checksum, len(lengths))
            }
        case "block": {
                sum := 0
                for _, length := range lengths[p.length] {
                    sum +=int(length)
                }
                if len(chunk) < sum {
                    break SPLIT
                }
                checksum := p.checksum(chunk[0:sum])
                if int(checksums[0]) != checksum {
                    return []Chunk{}, errors.New("block checksum failure")
                }
                for _, length := range lengths[p.length] {
                    sipped = append(sipped, int(length))
                    parts = append(parts,  chunk[0:int(length) - 1])
                    chunk = chunk[int(length):]
                }
                p.length++
                if (p.length == len(lengths)) {
                    chunks = append(chunks, Chunk{parts, sizes, sipped})
                    sizes = []int{}
                    sipped = []int{}
                    parts = [][]byte{}
                    p.length = 0
                    if (sip != 0) {
                        break SPLIT
                    }
                }
            }
        }
    }
    p.remainder = chunk
    p.lengths = lengths
    p.checksums = checksums
    p.parts = parts
    return chunks, nil
}

func (p *Player) Empty () bool {
    return p.remainder != nil && len(p.remainder) == 0
}
