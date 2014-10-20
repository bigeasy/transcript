var crypto = require('crypto')
var assert = require('assert')

function Output (checksum, count, header, body) {
    checksum.update(String(count), 'utf8')
    checksum.update(String(header.length), 'utf8')
    checksum.update(String(body.length), 'utf8')
    checksum.update(header)
    checksum.update(body)
    this.checksum = checksum.digest('hex')
    this.frame = new Buffer([ this.checksum, count, header.length, body.length ].join(' '))
    // 64 should be enough for now, enough for a petabyte header and body.
    assert(this.frame.length < 64, 'frame to large')
    this.header = header
    this.body = body
    this.length = this.frame.length + header.length + body.length + 3
}

Output.prototype.copy = function (target, offset) {
    this.frame.copy(target, offset)
    target[offset + this.frame.length] = 0xa
    offset += this.frame.length + 1

    this.header.copy(target, offset)
    target[offset + this.header.length] = 0xa
    offset += this.header.length + 1

    this.body.copy(target, offset)
    target[offset + this.body.length] = 0xa
}

function Writer (hash) {
    this._hash = hash
    this._count = 1
}

Writer.prototype.append = function (header, body) {
    this._count++
    return this._output(0, header, body)
}

Writer.prototype.terminate = function (header, body) {
    var count = this._count
    this._count = 1
    return this._output(count, header, body)
}

function createChecksum (hash) {
    return typeof hash == 'string'
         ? crypto.createHash(hash)
         : new hash(0)
}

Writer.prototype._output = function (count, header, body) {
    var output = new Output(createChecksum(this._hash), count, header, body)
    this.previous = this.checksum
    return output
}

function Input (hash, frameLength, offset, fields) {
    this._hash = hash
    this.offset = offset
    this.checksum = fields[0]
    this.count = +fields[1]
    this.headerLength = +fields[2]
    this.bodyLength = +fields[3]
    this.payloadLength = this.headerLength + this.bodyLength + 2
    this.length = frameLength + this.payloadLength
}

Input.prototype.read = function (source) {
    var checksum = createChecksum(this._hash)
    checksum.update(String(this.count), 'utf8')
    checksum.update(String(this.headerLength), 'utf8')
    checksum.update(String(this.bodyLength), 'utf8')
    var offset = this.offset
    this.header = source.slice(offset, offset + this.headerLength)
    checksum.update(this.header)
    offset += this.headerLength + 1
    this.body = source.slice(offset, offset + this.bodyLength)
    checksum.update(this.body)
    this.valid = checksum.digest('hex') == this.checksum
}

function Reader (options) {
    this._options = options
}

Reader.prototype.sip = function (source, offset) {
    offset = offset || 0
    for (var i = offset, I = Math.min(offset + 64, source.length); i < I; i++) {
        if (source[i] == 0xa) {
            break
        }
    }
    if (source[i] != 0xa) {
        return null
    }
    var frameLength = (i - offset) + 1
    var fields = source.toString('utf8', offset, i).split(' ')
    if (fields.length != 4) {
        return null
    }
    if (isNaN(+fields[1]) || isNaN(+fields[2]) || isNaN(+fields[3])) {
        return null
    }
    return new Input(this._options.hash, frameLength, offset + frameLength, fields)
}

Reader.prototype.rewind = function (source, i) {
    var I = -1, skip = 1
    if (source[--i] != 0xa) {
        return -1
    }
    OUTER: for (;;) {
        for (;;) {
            if (i == I) break OUTER
            --i
            if (source[i] == 0xa) break
        }
        if (skip--) {
            continue
        }
        return isFrame(source, i)
    }
    return -1
}

function isDecimal (ch) {
    return 48 <= ch && ch <=57
}

function isHex (ch) {
    return (48 <= ch && ch <=57) || (65 <= ch && ch <= 70) || (97 <= ch && ch <= 102)
}

function isFrame (source, offset) {
    var ch, isCorrect = isDecimal, count = 3, found = 0
    for (var i = offset - 1, I = Math.max(0, i - 64); i != I; i--) {
        if (32 == source[i]) {
            if (found == 0) {
                return -1
            } else if (count--) {
                found = 0
                if (count == 0) {
                    isCorrect = isHex
                }
            } else {
                return -1
            }
        } else {
            if (!isCorrect(source[i])) {
                return count == 0 && found != 0 ? i + 1 : -1
            }
            found++
        }
    }
    return -1
}

Reader.prototype.scan = function (direction, source, offset) {
    if (direction == 'reverse') {
        var i = offset == null ? source.length - 1 : offset, I = -1, last = i, inc = -1
    } else if (direction == 'forward') {
        var i = offset || 0, I = source.length, last = i, inc = 1
    } else {
        return -1
    }
    OUTER: for (;;) {
        for (;;) {
            if (i == I) break OUTER
            if (source[i] == 0xa) break
            i += inc
        }
        var found = isFrame(source, i)
        if (found != -1) {
            return found
        }
        last = i += inc
    }
    return -1
}

function Transcript (options) {
    options = options || {}
    options.hash = options.hash || require('hash.murmur3.32')
    this._options = options
}

Transcript.prototype.createWriter = function () {
    return new Writer(this._options.hash)
}

Transcript.prototype.createReader = function () {
    return new Reader(this._options)
}

module.exports = Transcript
