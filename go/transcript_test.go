package transcript

import (
    "testing"
    "encoding/json"
)

func NullChecksum (_ []byte) int {
    return 0
}

func TestBox (t *testing.T) {
    strs := []string{"a"}
    r := NewRecorder(NullChecksum)
    buffer, _ := json.Marshal(true)
    recorded := r.Record(strs, [][][]byte{ [][]byte{ buffer } })
    p := NewPlayer(NullChecksum)
    p.Split(recorded, 0)
}
