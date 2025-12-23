
import {createServer} from 'node:http';
import {findShipRLE, parseData, addShipsToFiles} from './index.js';


let lastRequestTime = new Map<string, number>();

let server = createServer(async (req, out) => {
    let ip = req.socket.remoteAddress;
    if (ip) {
        let time = performance.now() / 1000;
        let value = lastRequestTime.get(ip);
        if (value !== undefined) {
            if (time - value < 5) {
                out.writeHead(429);
                out.end();
                return;
            } else {
                lastRequestTime.set(ip, time);
            }
        } else {
            lastRequestTime.set(ip, time);
        }
    }
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
        if (!type || !dx || !dy || !period) {
            out.writeHead(400);
            out.end();
            return;
        }
        out.writeHead(200);
        out.write(await findShipRLE(type, parseInt(dx), parseInt(dy), parseInt(period)));
        out.end();
    } else if (endpoint === 'add') {
        if (!params) {
            out.writeHead(400);
            out.end();
            return;
        }
        let type = params.get('type');
    } else {
        out.writeHead(404);
        out.end();
    }
});

server.listen(3000, 'localhost');
