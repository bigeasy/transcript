use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
struct Person {
    name: String,
    age: usize,
    verified: bool,
}

fn main() {
    let json = r#"
        {
            "name": "George",
            "age": 27,
            "verified": false
        }
    "#;
    let person: Person = serde_json::from_str(json).unwrap();
    println!("hello, {}", person.name);
}
