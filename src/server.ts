
import {createServer} from 'node:http';


let server = createServer((req, out) => {
    if (!req.url) {
        out.writeHead(400);
        out.end();
        return;
    }
    let endpoint: string;
    let params: URLSearchParams | null;
    if (req.url.includes('?')) {
        let parts = req.url.slice(1).split('?');
        endpoint = parts[0];
        params = new URLSearchParams(parts[1]);
    } else {
        endpoint = req.url.slice(1);
        params = null;
    }
    if (endpoint === 'get') {
        if (!params) {
            out.writeHead(400);
            out.end();
            return;
        }
        let type = params.get('type');
        let dx = params.get('dx');
        let dy = params.get('dy');
        let period = params.get('period');
    } else if (endpoint === 'add') {

    } else {
        out.writeHead(404);
        out.end();
    }
});

server.listen(3000, 'localhost');
