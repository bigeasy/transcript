require('proof')(2, okay => {
    function checksum (buffer, start, end) { return end }
    const recorder = require('..').recorder(checksum)
    // format an entry with a record
    {
        const buffer = recorder([ Buffer.from('"a"'), Buffer.from('"a"') ])
        okay(buffer.toString().split(/\n/).slice(0, -1).map(function (line) {
            return JSON.parse(line)
        }), [ [ 6, 8 ], [ 4, 4 ], 'a', 'a' ], 'buffer')
    }
    // format an entry with no key or body
    {
        const buffer = recorder([])
        okay(buffer.toString().split(/\n/).slice(0, -1).map(function (line) {
            return JSON.parse(line)
        }), [ [ 3, 0 ], [] ], 'empty')
    }
})
