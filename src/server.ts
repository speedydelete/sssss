
import {join} from 'node:path';
import * as fs from 'node:fs/promises';
import {execSync} from 'node:child_process';
import {createServer} from 'node:http';
import {findShipRLE, parseData, addShipsToFiles} from './index.js';
import {speedToString} from '../lifeweb/lib/index.js';


let basePath = join(import.meta.dirname, '..');


let counts: {[key: string]: string} = {};

async function updateCountFor(type: string): Promise<void> {
    let data = [];
    let total = 0;
    for (let part of ['orthogonal', 'diagonal', 'oblique']) {
        let count = (await fs.readFile(join(basePath, 'data', type, part + '.sss'))).toString().split('\n').length - 1;
        total += count;
        data.push(count);
    }
    counts[type] = `This rulespace contains ${total} known speeds (${data[0]} orthogonals, ${data[1]} diagonals, and ${data[2]} obliques).`;
}

for (let type of await fs.readdir(join(basePath, 'data'))) {
    updateCountFor(type);
}


let lastGetTime = new Map<string, number>();
let lastAddTime = new Map<string, number>();
let lastGetCountsTime = new Map<string, number>();

let server = createServer(async (req, out) => {
    try {
        let ip = req.headers['x-forwarded-for'] as string;
        if (!ip) {
            out.writeHead(400, 'No IP address; cannot determine rate limits');
            out.end();
            return;
        }
        let time = performance.now() / 1000;
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
            let value = lastGetTime.get(ip);
            if (value !== undefined) {
                if (time - value < 5) {
                    out.writeHead(429);
                    out.end();
                    console.log(`${ip} exceeded rate limit on get after ${(time - value).toFixed(3)} seconds`);
                    return;
                } else {
                    lastGetTime.set(ip, time);
                }
            } else {
                lastGetTime.set(ip, time);
            }
            if (!params) {
                out.writeHead(400, 'Expected type, dx, dy, and period parameters');
                out.end();
                console.log(`${ip} attempted to get (no query string)`);
                return;
            }
            let type = params.get('type');
            let dx = params.get('dx');
            let dy = params.get('dy');
            let period = params.get('period');
            if (!type || !dx || !dy || !period) {
                out.writeHead(400, 'Expected type, dx, dy, and period parameters');
                out.end();
                console.log(`${ip} attempted to get in type ${type} (invalid parameters)`);
                return;
            }
            let dx2 = parseInt(dx);
            let dy2 = parseInt(dy);
            let period2 = parseInt(period);
            out.writeHead(200);
            out.write(await findShipRLE(type, dx2, dy2, period2));
            out.end();
            console.log(`${ip} got ${speedToString({dx: dx2, dy: dy2, period: period2})} in type ${type}`);
        } else if (endpoint === 'add') {
            let value = lastAddTime.get(ip);
            if (value !== undefined) {
                if (time - value < 5) {
                    out.writeHead(429);
                    out.end();
                    console.log(`${ip} exceeded rate limit on add after ${(time - value).toFixed(3)} seconds`);
                    return;
                } else {
                    lastAddTime.set(ip, time);
                }
            } else {
                lastAddTime.set(ip, time);
            }
            if (req.method !== 'POST') {
                out.writeHead(404);
                out.end();
                console.log(`${ip} attempted to add (wrong method)`);
                return;
            }
            if (!params) {
                out.writeHead(400, 'Expected type parameter');
                out.end();
                console.log(`${ip} attempted to add (no query string)`);
                return;
            }
            let type = params.get('type');
            if (!type) {
                out.writeHead(400, 'Expected type parameter');
                out.end();
                console.log(`${ip} attempted to add (no type parameter)`);
                return;
            }
            let data = '';
            req.on('data', chunk => {
                data += String(chunk);
            });
            req.on('end', async () => {
                try {
                    let ships = parseData(data);
                    if (ships.length > 100) {
                        out.writeHead(400, 'Max 100 ships');
                        out.end();
                        console.log(`${ip} attempted to add ${ships.length} ships to type ${type}`);
                        return;
                    }
                    let text = await addShipsToFiles(type, ships, 32768);
                    out.writeHead(200);
                    out.write(text);
                    out.end();
                    console.log(`${ip} added ${ships.length} ships to type ${type}`);
                } catch (error) {
                    console.error(error);
                    out.writeHead(500);
                    out.end();
                }
            });
            updateCountFor(type);
        } else if (endpoint === 'getcounts') {
            let value = lastGetCountsTime.get(ip);
            if (value !== undefined) {
                if (time - value < 0.3) {
                    console.log(`${ip} exceeded rate limit on getcounts after ${(time - value).toFixed(3)} seconds`);
                    out.writeHead(429);
                    out.end();
                    return;
                } else {
                    lastGetCountsTime.set(ip, time);
                }
            } else {
                lastGetCountsTime.set(ip, time);
            }
            if (!params) {
                out.writeHead(400, 'Expected type parameter');
                out.end();
                console.log(`${ip} attempted to getcounts (no query string)`);
                return;
            }
            let type = params.get('type');
            if (!type) {
                out.writeHead(400, 'Expected type parameter');
                out.end();
                console.log(`${ip} attempted to getcounts (no type parameter)`);
                return;
            }
            out.writeHead(200);
            out.write(counts[type]);
            out.end();
            console.log(`${ip} got counts on type ${type}`);
            return;
        } else {
            console.log(`${ip} attempted to ${req.method} endpoint ${endpoint}`);
            out.writeHead(404);
            out.end();
            return;
        }
    } catch (error) {
        console.error(error);
        out.writeHead(500);
        out.end();
    }
});

server.listen(3000, 'localhost');


function updateDataZip() {
    execSync(join(basePath, 'update_data_zip'), {stdio: 'inherit'});
    execSync(`cp ${join(basePath, 'data.zip')} /var/www/html/5s/data.zip`, {stdio: 'inherit'});
}

updateDataZip();
setInterval(updateDataZip, 86400000);
