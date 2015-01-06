var crypto = require('crypto')
var assert = require('assert')

function Writer (options) {
    this._hash = options.hash
    this._bufferSize = options.bufferSize
    this._count = 1
    this._destination = {
        buffer: new Buffer(this._bufferSize),
        offset: 0
    }
    this._checksum = createChecksum(this._hash).digest('hex')
    this._buffers = []
}

function lengthOf (object) {
    if (Buffer.isBuffer(object)) {
        return object.length
    } else {
        return Buffer.byteLength(object)
    }
}

function write (buffer, offset, object) {
    if (Buffer.isBuffer(object)) {
        object.copy(buffer, offset)
    } else {
        buffer.write(object, offset)
    }
}

function Output (writer, header) {
    this._writer = writer
    this._header = header
    this._count = 0
}

Output.prototype._serialize = function (count, header, body) {
    var headerLength = header ? lengthOf(header) : 'x',
        bodyLength = lengthOf(body)
    var checksum = createChecksum(this._writer._hash)
    checksum.update(String(count))
    checksum.update(String(headerLength))
    checksum.update(String(bodyLength))
    var frameLength = Buffer.byteLength([ this._writer._checksum, count, headerLength, bodyLength ].join(' '))
    // 64 should be enough for now, enough for a petabyte header and body.
    assert(frameLength < 64, 'frame to large')
    var written = frameLength + bodyLength + 2
    if (headerLength != 'x') {
        written += headerLength + 1
    }
    var buffer = this._writer._destination.buffer, offset = this._writer._destination.offset, start = offset
    if (buffer.length - offset < written) {
        if (offset != 0) {
            this._writer._buffers.push(buffer.slice(0, offset))
        }
        this._writer._destination = {
            buffer: new Buffer(Math.max(this._writer._bufferSize, written)),
            offset: 0
        }
        return this._serialize(count, header, body)
    }
    offset += frameLength + 1
    if (headerLength != 'x') {
        write(buffer, offset, header)
        checksum.update(buffer.slice(offset, offset + headerLength))
        buffer[offset + headerLength] = 0xa
        offset += headerLength + 1
    }
    write(buffer, offset, body)
    checksum.update(buffer.slice(offset, offset + bodyLength))
    buffer[offset + bodyLength] = 0xa
    offset += bodyLength + 1
    var checksum = checksum.digest('hex')
    assert(checksum.length == this._writer._checksum.length, 'checksum length inconsistent')
    var frame = new Buffer([ checksum, count, headerLength, bodyLength ].join(' '))
    write(buffer, start, frame)
    buffer[start + frameLength] = 0xa
    this._writer._destination.offset += written
    return {
        checksum: checksum,
        length: written
    }
}

Output.prototype.write = function (body) {
    this._count++
    var header = this._count == 1 ? this._header : null
    return this._serialize(0, header, body)
}

Output.prototype.end = function (body) {
    this._count++
    var header = this._count == 1 ? this._header : null
    return this._serialize(this._count, header, body)
}

Writer.prototype.output = function (header) {
    return new Output(this, header)
}

Writer.prototype.end = function () {
    var buffer = this._destination.buffer, offset = this._destination.offset, start = offset
    this._buffers.push(buffer.slice(0, offset))
}

Writer.prototype.buffers = function () {
    return this._buffers.slice(0, this._buffers.length)
}

function createChecksum (hash) {
    return typeof hash == 'string'
         ? crypto.createHash(hash)
         : new hash(0)
}

function Reader (options, buffers) {
    this._options = options
    this._buffers = []
    this._position = { index: 0, offset: 0 }
    this._end = { index: 0, offset: 0 }
}

Reader.prototype.distance = function (start, end) {
    if (start.index == end.index) {
        return end.offset - start.offset
    }
    var distance = this._buffers[start.index].length - start.offset
    for (var i = start.index + 1, I = end.index; i < I; i++) {
        distance += this._buffers[i].length
    }
    distance += end.offset
    return distance
}

Reader.prototype.slice = function (start, end) {
    if (typeof end == 'number') {
        var _end = end
        end = this.advance(start, end)
        assert(end, 'cannot advance for slice')
    }
    if (start.index == end.index) {
        return this._buffers[start.index].slice(start.offset, end.offset)
    }
    var buffers = [ this._buffers[start.index].slice(start.offset) ]
    for (var i = start.index + 1, I = end.index; i < I; i++) {
        buffers.push(this._buffers[i])
    }
    buffers.push(this._buffers[end.index].slice(0, end.offset))
    return Buffer.concat(buffers)
}

Reader.prototype.remainder = function () {
    return this.distance(this._position, this._end)
}

Reader.prototype.push = function (buffer) {
    this._buffers.push(buffer)
    this._end = {
        index: this._buffers.length - 1,
        offset: this._buffers[this._buffers.length - 1].length
    }
}

Reader.prototype.freeze = function () {
    this.purge()
    var offset = this._position.offset
    this._buffers = this._buffers.map(function (buffer) {
        buffer = Buffer.concat([ buffer.slice(offset), new Buffer(0) ])
        offset = 0
        return buffer
    })
    this._position.offset = 0
}

Reader.prototype.purge = function () {
    while (this._position.index != 0) {
        this._buffers.shift()
        this._position.index--
    }
}

Reader.prototype.read = function () {
    this.purge()
    var mark = this._position, sip = this.sip()
    if (sip) {
        if (sip.length == 0) {
            return null
        }
        // validate
        if (this.distance(sip.payload.mark, this._end) < sip.payload.length) {
            this._position = mark
            return null
        }
        var record = {}
        if (sip.header != null) {
            record.header = this.slice(sip.header.mark, sip.header.length)
        }
        record.count = sip.count
        record.body = this.slice(sip.body.mark, sip.body.length)
        record.length = sip.length
        var checksum = createChecksum(this._options.hash)
        checksum.update(String(sip.count), 'utf8')
        checksum.update(String(sip.header ? sip.header.length : 'x'), 'utf8')
        checksum.update(String(sip.body.length), 'utf8')
        if (record.header) {
            checksum.update(record.header)
        }
        checksum.update(record.body)
        record.valid = checksum.digest('hex') == sip.checksum

        this._position = this.advance(mark, sip.length)
        return record
    } else {
        throw new Error('invalid header')
    }
}

Reader.prototype.advance = function (mark, distance) {
    var index = mark.index, offset = mark.offset
    var add = 0
    while (index < this._buffers.length) {
        var buffer = this._buffers[index]
        if (distance <= buffer.length - offset) {
            return {
                index: index,
                offset: offset + distance
            }
        }
        add += (buffer.length - offset)
        distance -= buffer.length - offset
        offset = 0
        index++
    }
    return null
}

Reader.prototype.sip = function () {
    var start = this._position, buffers = this._buffers

    var index = start.index, offset = start.offset, length = 64
    OUTER: for (var i = index, I = this._buffers.length; i< I; i++) {
        var source = this._buffers[i]
        for (var j = offset, J = source.length; j < J && length--; j++) {
            if (source[j] == 0xa) {
                break OUTER
            }
        }
        offset = 0
    }

    if (!source || source[j] != 0xa) {
        return { length: 0 }
    }

    var end = { index: i, offset: j + 1 }
    var distance = this.distance(start, end)

    var buffer = this.slice(start, end)

    var fields = buffer.toString('utf8', 0, buffer.length - 1).split(' ')
    if (fields.length != 4) {
        return null
    }
    if (isNaN(+fields[1]) || (isNaN(+fields[2]) && fields[2] != 'x') || isNaN(+fields[3])) {
        return null
    }

    var sip = {}, headerLength = 0, mark = end, payloadLength = 0
    sip.checksum = fields[0]
    sip.count = +fields[1]
    sip.frame = {
        mark: start,
        length: this.distance(start, end) - 1
    }
    if (fields[2] != 'x') {
        sip.header = { mark: mark, length: +fields[2] }
        payloadLength = sip.header.length + 1
        mark = this.advance(mark, payloadLength)
    }
    sip.body = {
        mark: mark,
        length: +fields[3]
    }
    sip.payload = {
        mark: fields[2] == 'x' ? sip.body.mark : sip.header.mark,
        length: payloadLength + sip.body.length + 1
    }
    sip.length = sip.frame.length + 1 + sip.payload.length

    return sip
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
    options.bufferSize = options.bufferSize || 1024 * 16
    options.checksum = options.checksum
    this._options = options
}

Transcript.prototype.createWriter = function () {
    return new Writer(this._options)
}

Transcript.prototype.createReader = function () {
    return new Reader(this._options)
}

module.exports = Transcript
