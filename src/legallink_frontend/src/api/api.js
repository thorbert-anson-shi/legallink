import { createServer } from "node:http";

const hostname = "127.0.0.1";
const port = 3000;

const server = createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");

    switch (req.url) {
        case "/":
            res.write("This is the home route");
            break;
        case "/hello":
            res.write("This is the hello route");
            break;
        case "/test":
            let data = {
                "response": "This is the chatbot's response",
                "length": 42069,
            };

            res.write(JSON.stringify(data));
            break;
        default:
            res.write("This is any other route");
    }
    res.end();
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
