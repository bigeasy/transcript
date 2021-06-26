package transcript

import (
    "os"
    "fmt"
    "testing"
    "encoding/json"
)

type Recorder struct {
}

func NewRecorder (t *testing.T, keys []string) {
    bolB, _ := json.Marshal(keys)
    t.Logf(string(bolB))
}

func (recorder *Recorder) Record (keys []string, blocks [][]byte) {
    lengths := []int{}
    other := [][]int{}
    for _, block := range blocks {
        lengths = append(lengths, len(block))
        other = append(other, []int{})
    }
    fmt.Fprintf(os.Stdout, "hello %d\n", len(other))
}
