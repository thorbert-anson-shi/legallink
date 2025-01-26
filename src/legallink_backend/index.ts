import express, { Request, Response } from 'express';

// Busboy is used to parse form data from HTML forms (we will utilize it to accept the PDF files)
import busboy from 'busboy';

// pdfParse can be used to parse the PDF file, but other libs are also available
import pdfParse from 'pdf-parse';

import { processData } from './utils';

const app = express();

// Examples
app.get('/', function (req: Request, res: Response) {
    res.send("Hello, this is the home route");
});

// For query params, use req.query instead of req.params
app.get('/greet', function (req: Request, res: Response) {
    if (req.query.name != null) {
        res.send((req.query.name as string).toUpperCase());
    } else {
        res.send("Name query parameter is missing");
    }
})

// ACTUAL CODE STARTS HERE
app.get('/analyze', function (req: Request, res: Response) {
    const bb = busboy({ headers: req.headers });
    let fileBuffer: Buffer = Buffer.alloc(0);

    // Create event handlers for busboy
    // When the form contains file data, store it in memory
    bb.on("file", (_name, stream, info) => {
        const { filename, encoding, mimeType } = info;

        // Use mimeType to determine if file is PDF, else return 400 response
        if (mimeType !== 'application/pdf') {
            res.status(400).send('Only PDF files are allowed.');
            stream.resume(); // Discard the file stream
            return;
        }

        // When data comes in, pass the chunk into the memory buffer
        stream.on('data', (data) => {
            fileBuffer = Buffer.concat([fileBuffer, data]);
        })

        // When the data stream ends, confirm end of file
        stream.on('end', () => {
            console.log(`File ${filename} has been read. ${fileBuffer.length} bytes read.`)
        })
    })

    // TODO: File data is passed here. For implementation, modify utils.ts
    bb.on('finish', () => {
        let response = processData(fileBuffer);
        res.status(200).write(response);
        res.end();
    })

    // After setting up event handlers, direct the request to busboy
    req.pipe(bb);
})

app.listen();
