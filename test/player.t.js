require('proof')(7, okay => {
    function checksum (buffer, start, end) { return end - start }
    const recorder = require('..').recorder(checksum)
    const Player = require('..').Player
    {
        const player = new Player(checksum)
        okay(player != null, 'constructed')
    }
    {
        const player = new Player(checksum)
        const buffers = [
            recorder({}, [ Buffer.from('a'), Buffer.from('b') ]),
            recorder({ value: 1 }, [])
        ]
        const buffer = Buffer.concat(buffers)
        okay(player.split(buffer.slice(0, 4)), [], 'middle of checksum')
        okay(!player.empty(), 'player has remainder')
        okay(player.split(buffer.slice(4, 10)), [], 'middle of header')
        okay(player.split(buffer.slice(10, 40)), [], 'middle of payload')
        const [ one, two ] = player.split(buffer.slice(40))
        okay(two, {
            header: { value: 1 },
            parts: [],
            sizes: [ 7, 36 ]
        }, 'no parts')
        one.parts = one.parts.map(buffer => buffer.toString())
        okay(one, {
            header: {},
            parts: [ 'a', 'b' ],
            sizes: [ 7, 30, 2, 2 ]
        }, 'parts')
    }
})
