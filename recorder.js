exports.create = function (checksum) {
    const EOL = Buffer.from('\n')
    return function (blocks) {
        const payload = [], buffers = [], checksums = [], lengths = []
        const body = []
        for (const block of blocks) {
            body.push([])
            lengths.push([])
            for (const part of block) {
                body[body.length - 1].push(part, EOL)
                lengths[lengths.length - 1].push(part.length + 1)
            }
        }
        for (let i = 0, I = body.length; i < I; i++) {
            body[i] = Buffer.concat(body[i])
            checksums.push(checksum(body[i], 0, body[i].length))
            buffers.push(body[i])
        }
        buffers.unshift(Buffer.concat([ Buffer.from(JSON.stringify(lengths)), EOL ]))
        checksums.unshift(checksum(buffers[0], 0, buffers[0].length))
        buffers.unshift(Buffer.from(JSON.stringify(checksums)), EOL)
        return Buffer.concat(buffers)
    }
}
