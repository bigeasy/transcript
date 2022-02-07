// use serde::{Deserialize, Serialize};

pub struct Recorder {
    checksum: fn(&Vec<u8>) -> u32
}

impl Recorder {
    pub fn record(&self, blocks: Vec<Vec<Vec<u8>>>) {
        let mut checksums: Vec<u32> = Vec::new();
        let mut bodies: Vec<Vec<u8>> = Vec::new();
        for block in blocks {
            let mut body: Vec<u8> = Vec::new();
            for part in block {
                body.extend(&part);
            }
            checksums.push((self.checksum)(&body));
            bodies.push(body);
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        let result = 2 + 2;
        assert_eq!(result, 4);
    }
}
