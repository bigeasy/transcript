require('proof')(2, okay => {
    function checksum (buffer, start, end) { return end }
    const Recorder = require('..').Recorder
    const recorder = Recorder.create(checksum)
    // format an entry with a record
    {
        const buffer = recorder([[ Buffer.from('"a"'), Buffer.from('"b"') ], [ Buffer.from('"c"') ]])
        okay(buffer.toString().split(/\n/).slice(0, -1).map(function (line) {
            return JSON.parse(line)
        }), [ [ 12, 8, 4 ], [ [ 4, 4 ], [ 4 ] ], 'a', 'b', 'c' ], 'buffer')
    }
    // format an entry with no key or body
    {
        const buffer = recorder([])
        okay(buffer.toString().split(/\n/).slice(0, -1).map(function (line) {
            return JSON.parse(line)
        }), [ [ 3 ], [] ], 'empty')
    }
})
