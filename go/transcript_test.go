package transcript

import (
    "os"
    "fmt"
    "testing"
    "encoding/json"
    "github.com/stretchr/testify/assert"
)

func NullChecksum (_ []byte) int {
    return 0
}

func TestFullCycle (t *testing.T) {
    assert := assert.New(t)
    r := NewRecorder(NullChecksum)
    buffer, _ := json.Marshal(true)
    recorded := r.Record([][][]byte{ [][]byte{ buffer } })
    p := NewPlayer(NullChecksum)
    chunks, _ := p.Split(recorded, 0)
    if len(chunks) != 1 {
        t.Fatal("unexepcted chunk size")
    }
    fmt.Fprintf(os.Stdout, "retrieved %s %d\n", string(chunks[0].parts[0]), chunks[0].sipped)
    assert.Equal(string(chunks[0].parts[0]), "true", "body restored")
    assert.ElementsMatch(chunks[0].sizes, []int{4, 6, 5}, "sizes")
    assert.ElementsMatch(chunks[0].sipped, []int{4, 6, 5}, "sipped")
    assert.Equal(p.Empty(), true, "is empty")
}
