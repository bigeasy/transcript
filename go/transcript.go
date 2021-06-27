package transcript

import (
    "bytes"
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
}

func NewPlayer (checksum ChecksumFunc) *Player {
    return &Player{checksum, "checksum"}
}

type Chunk struct {
    parts [][]byte
    sizes []int
    sipped []int
}

func (p *Player) Noop () {
}

func (p *Player) Split (chunk []byte, sip int) []Chunk {
    var sizes []int
    var chunks []Chunk
    SPLIT: for {
        switch p.state {
        case "checksum": {
                i := bytes.IndexByte(chunk, 0xa)
                if i == -1 {
                    break SPLIT
                }
                sizes = append(sizes, i)
                var checksums []float64
                json.Unmarshal(chunk[0:i], &checksums)
                fmt.Fprintf(os.Stdout, "here %d \n", len(checksums))
                return chunks
            }
        }
    }
    return chunks
}
