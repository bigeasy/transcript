require('proof')(41, function (assert) {
    var Transcript = require('../../transcript')

    var record = {
        head: new Buffer('a'),
        body: new Buffer('b')
    }

    test(new Transcript, '9263a8c4')
    test(new Transcript({ hash: 'sha1' }), '1b89348164bea18497613f19f5c2f489ee3aa5ca')

    function test (transcript, checksum) {
        var buffer = new Buffer(4098)

        var writer = transcript.createWriter()
        var output = writer.terminate(record.head, record.body)

        assert(output.frame.toString(), checksum + ' 1 1 1', 'frame')
        assert(output.length, checksum.length + 11, 'length')

        buffer.fill(0)
        output.copy(buffer, 7)

        var reader = transcript.createReader()

        assert(reader.scan('forward', buffer), 7, 'scan forward')
        assert(reader.scan('reverse', buffer), 7, 'scan backward')
        assert(reader.scan('reverse', buffer, 1024), 7, 'scan backward with offset')

        var input = reader.sip(buffer, 7)
        assert(input.checksum, checksum, 'sip checksum')
        assert(input.count, 1, 'sip count')
        assert(input.headerLength, 1, 'sip header length')
        assert(input.bodyLength, 1, 'sip header length')
        assert(input.payloadLength, 4, 'sip remaining length')

        input.read(buffer, input.offset)

        assert(input.header.toString(), 'a', 'read header')
        assert(input.body.toString(), 'b', 'read body')
    }

    var transcript = new Transcript
    var buffer = new Buffer(4098)
    var writer = transcript.createWriter(), output
    var reader = transcript.createReader(), input
    var offset = 4

    output = writer.append(record.head, record.body)

    buffer.fill(0)
    output.copy(buffer, offset)

    offset += output.length

    output = writer.terminate(record.head, record.body)
    output.copy(buffer, offset)

    // todo: make that 7.
    offset = 4

    input = reader.sip(buffer, offset)
    input.read(buffer)

    assert(input.valid, 'chunk valid')
    assert(input.count, 0, 'chunk count')
    assert(input.length, 19, 'chunk length')

    offset += input.length

    assert(reader.rewind(buffer, offset), 4, 'rewind')
    assert(reader.rewind(buffer, 1024), -1, 'rewind not at new line')
    assert(reader.rewind(buffer, 19), -1, 'rewind not found')

    input = reader.sip(buffer, offset)
    input.read(buffer)

    assert(input.valid, 'end valid')
    assert(input.count, 2, 'end count')
    assert(input.length, 19, 'end length')

    assert(reader.sip(buffer, 1024), null, 'sip no new line')
    assert(reader.sip(new Buffer('1 2\n')), null, 'sip not enough fields')
    assert(reader.sip(new Buffer('a a a a\n')), null, 'sip fields are not numbers')

    assert(reader.scan('fred'), -1, 'scan unknown direction')
    assert(reader.scan('forward', buffer, 1024), -1, 'scan not found')
    assert(reader.scan('forward', new Buffer('  \n')), -1, 'scan not frame spaces')
    assert(reader.scan('forward', new Buffer('1 2 3 4 5\n')), -1, 'scan not frame too many fields')
    assert(reader.scan('forward', new Buffer('1 2 3\n')), -1, 'scan not frame not enough fields')
})
