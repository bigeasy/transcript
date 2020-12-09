const assert = require('assert')
const EOL = Buffer.from('\n')

class Player {
    constructor (checksum) {
        this._checksum = checksum
        this._remainder = Buffer.alloc(0)
        this._length = 0
        this._lengths = null
        this._parts = null
        this._entry = {
            state: 'checksum',
            header: null,
            checksums: null,
            sizes: []
        }
    }

    split (chunk, sip = null) {
        const entries = []
        let { state, checksums, sizes, sipped } = this._entry, start = 0
        let lengths = this._lengths
        let parts = this._parts
        chunk = Buffer.concat([ this._remainder, chunk ])
        SPLIT: for (;;) {
            switch (state) {
            case 'checksum': {
                    const index = chunk.indexOf(0xa, start)
                    if (!~index) {
                        break SPLIT
                    }
                    sizes.push(index - start + 1)
                    checksums = JSON.parse(chunk.slice(start, index + 1))
                    start = index + 1
                    state = 'lengths'
                }
                break
            case 'lengths': {
                    const index = chunk.indexOf(0xa, start)
                    if (!~index) {
                        break SPLIT
                    }
                    sizes.push(index - start + 1)
                    sipped = sizes.slice()
                    const buffer = chunk.slice(start, index + 1)
                    assert.equal(checksums[0], this._checksum.call(null, buffer, 0, buffer.length))
                    lengths = JSON.parse(buffer.toString())
                    sizes.push.apply(sizes, lengths.flat())
                    if (sip != null) {
                        lengths = lengths.splice(0, sip)
                    }
                    state = 'block'
                    start = index + 1
                    parts = []
                }
                break
            case 'block': {
                    const length = lengths[this._length].reduce((sum, value) => sum + value, 0)
                    if (chunk.length - start < length) {
                        break SPLIT
                    }
                    const checksum = this._checksum.call(null, chunk, start, start + length)
                    assert.equal(checksums[1 + this._length], checksum)
                    for (const length of lengths[this._length]) {
                        sipped.push(length)
                        let part = chunk.slice(start, start + length - 1)
                        start = start + length
                        parts.push(part)
                    }
                    this._length++
                    if (lengths.length == this._length) {
                        entries.push({
                            parts: parts,
                            sizes: sizes,
                            sipped: sipped
                        })
                        this._length = 0
                        sizes = []
                        sipped = []
                        state = 'checksum'
                        if (sip != null) {
                            break SPLIT
                        }
                    }
                }
                break
            }
        }
        this._remainder = sip == null || entries.length == 0 ? chunk.slice(start) : Buffer.alloc(0)
        this._lengths = lengths
        this._parts = parts
        this._entry = { state, checksums, sizes, sipped }
        return entries
    }

    empty () {
        return this._remainder.length == 0
    }
}

module.exports = Player
