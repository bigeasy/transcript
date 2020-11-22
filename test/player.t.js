require('proof')(8, okay => {
    function checksum (buffer, start, end) { return end - start }
    const { Recorder, Player } = require('..')
    const recorder = Recorder.create(checksum)
    {
        const player = new Player(checksum)
        okay(player != null, 'constructed')
    }
    {
        const player = new Player(checksum)
        const buffers = [
            recorder([[ Buffer.from('a'), Buffer.from('b') ], [ Buffer.from('c') ]]),
            recorder([[]])
        ]
        const buffer = Buffer.concat(buffers)
        okay(player.split(buffer.slice(0, 4)), [], 'middle of checksum')
        okay(!player.empty(), 'player has remainder')
        okay(player.split(buffer.slice(4, 10)), [], 'middle of header')
        okay(player.split(buffer.slice(10, 23)), [], 'middle of payload')
        const [ one, two ] = player.split(buffer.slice(23))
        one.parts = one.parts.map(buffer => buffer.toString())
        okay(one, {
            parts: [ 'a', 'b', 'c' ],
            sizes: [ 9, 12, 2, 2, 2 ],
            sipped: [ 9, 12, 2, 2, 2 ]
        }, 'parts')
        okay(two, {
            parts: [],
            sizes: [ 6, 5 ],
            sipped: [ 6, 5 ]
        }, 'no parts')
        const [ sip ] = player.split(buffer, 1)
        sip.parts = sip.parts.map(buffer => buffer.toString())
        okay(sip, {
            parts: [ 'a', 'b' ],
            sizes: [ 9, 12, 2, 2, 2 ],
            sipped: [ 9, 12, 2, 2 ]
        }, 'sipped')
    }
})
