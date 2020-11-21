
var serialized = '\
a8156bbd 0 1 1\n\
a\n\
b\n\
49328435 2 x 1\n\
a\n'

require('proof')(41, prove)

function prove (assert) {
    var Transcript = require('../../transcript')

    var record = {
        head: new Buffer('a'),
        body: new Buffer('b')
    }

    function test (transcript, checksum) {
        var buffer = new Buffer(4098)

        var writer = transcript.createWriter()
        var output = writer.output(record.head).end(record.body)

        writer.end()

        var buffer = writer.buffers().shift()

        assert(buffer.toString('utf8', 0, output.checksum.length + 6), output.checksum + ' 1 1 1', 'frame')
        assert(output.length, output.checksum.length + 11, 'length')

        var reader = transcript.createReader()

        var wilderness = new Buffer(4092)
        wilderness.fill(0)
        buffer.copy(wilderness, 7)

        reader.push(buffer)

        assert(reader.scan('forward', wilderness), 7, 'scan forward')
        assert(reader.scan('reverse', wilderness), 7, 'scan backward')
        assert(reader.scan('reverse', wilderness, 1024), 7, 'scan backward with offset')

        var input = reader.read()
        assert(input.count, 1, 'sip count')
        assert(input.header.length, 1, 'sip header length')
        assert(input.body.length, 1, 'sip header length')
        assert(input.header.toString(), 'a', 'read header')
        assert(input.body.toString(), 'b', 'read body')
    }

    var transcript = new Transcript({ bufferSize: 4098 })
    var buffer = new Buffer(4098)
    var writer = transcript.createWriter(), output
    var reader = transcript.createReader(), input
    var offset = 4

    assert(reader.remainder(), 0, 'empty')

    var output = writer.output(record.head)
    assert(output.write(record.body).length, 19, 'write chunk')
    assert(output.end('a').length, 17, 'end chunk')

    writer.end()

    var buffer = writer.buffers().shift()
    assert(buffer.slice(0, 37).toString(), serialized, 'serialized')

    reader.push(buffer)
    input = reader.read()
    input.header = input.header.toString()
    input.body = input.body.toString()
    assert(input, {
        valid: true,
        count: 0,
        length: 19,
        header: 'a',
        body: 'b'
    }, 'read header and chunk')
    input = reader.read()
    input.body = input.body.toString()
    assert(input, {
        valid: true,
        count: 2,
        length: 17,
        body: 'a'
    }, 'read chunk')

    assert(reader.read() == null, 'eof')


    var wilderness = new Buffer(1024)
    wilderness.fill(0)
    buffer.copy(wilderness, 4)

    offset = buffer.length + 4

    assert(reader.scan('fred'), -1, 'scan unknown direction')
    assert(reader.scan('forward', wilderness, 1024), -1, 'scan not found')
    assert(reader.scan('forward', new Buffer('  \n')), -1, 'scan not frame spaces')
    assert(reader.scan('forward', new Buffer('1 2 3 4 5\n')), -1, 'scan not frame too many fields')
    assert(reader.scan('forward', new Buffer('1 2 3\n')), -1, 'scan not frame not enough fields')

    var block = new Buffer(256)
    for (var i = 0, I = block.length; i < I; i++) {
        block[i] = i
    }

    var transcript = new Transcript({ bufferSize: 32 })
    var writer = transcript.createWriter(), output
    var output = writer.output(JSON.stringify({ a: 1 }))
    assert(output.end(block).length, 282, 'first large block')
    var output = writer.output()
    assert(output.write(block).length, 274, 'large block as chunk')
    assert(output.write(block).length, 274, 'large block as chunk continue')
    assert(output.end(block).length, 274, 'large block as terminal')

    var reader = transcript.createReader(), inputs = [], input
    var buffer = Buffer.concat(writer.buffers())
    for (var i = 0, I = buffer.length; i < I; i += 11) {
        var slice = buffer.slice(i, i + 11)
        reader.push(slice)
        input = reader.read()
        if (input) {
            inputs.push(input)
        }
        reader.freeze()
    }

    assert(inputs.every(function (input) { return input.valid }), 'read acorss blocks')

    test(new Transcript, '9263a8c4')
    test(new Transcript({ hash: 'sha1' }), '1b89348164bea18497613f19f5c2f489ee3aa5ca')

    try {
        var reader = transcript.createReader()
        reader.push(new Buffer('1 2 3\n'))
        reader.read()
    } catch (e) {
        assert(e.message, 'invalid header', 'wrong number of fields')
    }

    try {
        var reader = transcript.createReader()
        reader.push(new Buffer('a . 2 3\n'))
        reader.read()
    } catch (e) {
        assert(e.message, 'invalid header', 'invalid count')
    }

    try {
        var reader = transcript.createReader()
        reader.push(new Buffer('a 1 . 3\n'))
        reader.read()
    } catch (e) {
        assert(e.message, 'invalid header', 'invalid header length')
    }

    try {
        var reader = transcript.createReader()
        reader.push(new Buffer('a 1 x .\n'))
        reader.read()
    } catch (e) {
        assert(e.message, 'invalid header', 'invalid body length')
    }
}
