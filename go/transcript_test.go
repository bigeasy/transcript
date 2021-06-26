package transcript

import (
    "testing"
    "encoding/json"
)

func TestBox (t *testing.T) {
    strs := []string{"a"}
    NewRecorder(t, strs)
    buffer, _ := json.Marshal(true)
    r := Recorder{}
    r.Record(strs, [][]byte{ buffer })
}
