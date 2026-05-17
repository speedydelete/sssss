
import {normalize} from 'node:path';
import * as fs from 'node:fs/promises';
import {execSync} from 'node:child_process';
import {Worker} from 'node:worker_threads';
import {IncomingMessage, ServerResponse, createServer} from 'node:http';
import {speedToString} from '../lifeweb/lib/index.js';
import {Type, TYPES, Ship, parseData, addShipsToFiles, findShipRLE, shipIsOptimal} from './index.js';


let basePath = normalize(`${import.meta.dirname}/..`);

function getLineNumber(error: Error): string  | undefined{
    return (error.stack as string).split('\n')[1].split(':').at(-2);
}

// let adminKeys = JSON.parse((await fs.readFile(`${basePath}/admin_keys.json`)).toString()) as {[key: string]: string};

// if (!adminKeys || typeof adminKeys !== 'object' || !Object.keys(adminKeys).every(x => typeof adminKeys[x] === 'string')) {
//     throw new Error('Invalid admin keys!');
// }


let counts: {[key: string]: string} = {};

async function updateCountFor(type: string): Promise<void> {
    let data = [];
    let total = 0;
    for (let part of ['oscillator', 'orthogonal', 'diagonal', 'oblique']) {
        let count = (await fs.readFile(`${basePath}/data/${type}/${part}.sss`)).toString().split('\n').length - 1;
        total += count;
        data.push(count);
    }
    counts[type] = `This rulespace contains ${total} known nonadjustable speeds (${data[0]} oscillators, ${data[1]} orthogonals, ${data[2]} diagonals, and ${data[3]} obliques).`;
}

for (let type of await fs.readdir(`${basePath}/data`)) {
    if (!type.includes('.')) {
        updateCountFor(type);
    }
}


type WorkerData = ReturnType<typeof addShipsToFiles> extends Promise<infer T> ? T : never;

type WorkerResult = {id: number, ok: true, data: WorkerData} | {id: number, ok: false, data: string};

interface JobData {
    resolve: (data: WorkerData) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
}

let worker: Worker;

let jobs = new Map<number, JobData>();
let nextID = 0;

function workerOnMessage(msg: WorkerResult): void {
    let job = jobs.get(msg.id);
    if (!job) {
        return;
    }
    if (!msg.ok) {
        job.reject(msg.data);
    } else {
        job.resolve(msg.data);
    }
    clearTimeout(job.timeout);
    jobs.delete(msg.id);
}

let restarting = false;

function restartWorker() {
    if (restarting) {
        return;
    }
    restarting = true;
    try {
        worker.terminate();
    } catch {}
    worker = new Worker(`${import.meta.dirname}/server_worker.js`);
    worker.on('message', workerOnMessage);
    worker.on('error', workerOnError);
    worker.on('exit', workerOnExit);
    restarting = false;
}

restartWorker();

function workerHandleFatal(error: Error): void {
    for (let job of jobs.values()) {
        clearTimeout(job.timeout);
        job.reject(error);
    }
    jobs.clear();
    restartWorker();
}

function workerOnError(error: Error): void {
    console.log(error);
    workerHandleFatal(error);
}

function workerOnExit(code: number): void {
    if (code === 0) {
        process.exit(1);
    }
    let msg = 'Worker exited with code ' + code;
    console.log(msg + ' restarting worker');
    workerHandleFatal(new Error(msg));
}

async function addShipsToFilesWorker(type: string, ships: Ship[], limit?: number, includeComments?: boolean): Promise<WorkerData> {
    return new Promise((resolve, reject) => {
        let id = nextID++;
        let timeout = setTimeout(() => {
            jobs.delete(id);
            resolve(['Timed out', {}]);
            restartWorker();
        }, 30000);
        jobs.set(id, {resolve, reject, timeout});
        worker.postMessage({id, type, ships, limit, includeComments});
    });
}


let newSpeeds: [string, string, number][] = [];
let improvedSpeeds: [string, string, number, number][] = [];
let newPeriods: [string, string, number][] = [];
let improvedPeriods: [string, string, number, number][] = [];

let lastGetTime = new Map<string, number>();
let lastAddTime = new Map<string, number>();
let lastGetCountsTime = new Map<string, number>();
let lastGetNewShipsTIme = new Map<string, number>();
let lastGetPeriodMapTime = new Map<string, number>();

let maxJobsExceeded = false;

let periodMaps: {[key: string]: Uint32Array[]} = {};


const ENDPOINTS: {[key: string]: (req: IncomingMessage, params: URLSearchParams | null, out: ServerResponse<IncomingMessage>, ip: string, time: number) => void | Promise<void>} = {

    async get(req: IncomingMessage, params: URLSearchParams | null, out: ServerResponse<IncomingMessage>, ip: string, time: number): Promise<void> {
        let value = lastGetTime.get(ip);
        if (value !== undefined) {
            if (time - value < 1) {
                out.writeHead(429);
                out.end();
                console.log(`429 Too Many Requests (${(time - value).toFixed(3)} seconds, ${getLineNumber(new Error())})`); 
                return;
            } else {
                lastGetTime.set(ip, time);
            }
        } else {
            lastGetTime.set(ip, time);
        }
        if (req.method !== 'GET') {
            out.writeHead(405);
            out.end();
            console.log(`405 Method Not Allowed (${getLineNumber(new Error())})`); 
            return;
        }
        if (!params) {
            out.writeHead(400, 'Expected "type", "dx", "dy", And "period" Parameters');
            out.end();
            console.log(`400 Expected "type", "dx", "dy", And "period" Parameters (no query string, ${getLineNumber(new Error())})`); 
            return;
        }
        let type = params.get('type');
        let dxP = params.get('dx');
        let dyP = params.get('dy');
        let periodP = params.get('period');
        let adjustables = params.get('adjustables');
        if (!type || !dxP || !dyP || !periodP) {
            out.writeHead(400, 'Expected "type", "dx", "dy", And "period" Parameters');
            out.end();
            console.log(`400 Expected "type", "dx", "dy", And "period" Parameters (${getLineNumber(new Error())})`); 
            return;
        }
        let dx = parseInt(dxP);
        let dy = parseInt(dyP);
        let period = parseInt(periodP);
        if (!TYPES.includes(type as Type) || Number.isNaN(dx) || Number.isNaN(dy) || Number.isNaN(period) || (adjustables !== undefined && !(adjustables === 'yes' || adjustables === 'no' || adjustables === 'only'))) {
            out.writeHead(400, 'Invalid Parameters');
            out.end();
            console.log(`400 Invalid Parameters (${getLineNumber(new Error())})`); 
            return;
        }
        out.writeHead(200);
        out.write(await findShipRLE(type as Type, dx, dy, period, adjustables));
        out.end();
        console.log(`200 OK (${speedToString(dx, dy, period)} in type ${type})`);
    },

    add(req: IncomingMessage, params: URLSearchParams | null, out: ServerResponse<IncomingMessage>, ip: string, time: number): void {
        let value = lastAddTime.get(ip);
        if (value !== undefined) {
            if (time - value < 5) {
                out.writeHead(429);
                out.end();
                console.log(`429 Too Many Requests (${(time - value).toFixed(3)} seconds, ${getLineNumber(new Error())})`); 
                return;
            } else {
                lastAddTime.set(ip, time);
            }
            if (jobs.size > 5) {

            }
        } else {
            lastAddTime.set(ip, time);
        }
        if (maxJobsExceeded) {
            if (jobs.size === 0) {
                maxJobsExceeded = false;
            } else {
                out.writeHead(500, 'Too Busy');
                out.end();
                console.log(`500 Too Busy (attempted to add when cleaning up after too many jobs (currently ${jobs.size} active jobs), ${getLineNumber(new Error())})`); 
                return;
            }
        }
        if (jobs.size > 4) {
            maxJobsExceeded = true;
            out.writeHead(500, 'Too Busy');
            out.end();
            console.log(`500 Too Busy (attempted to add when there are already ${jobs.size} active jobs, ${getLineNumber(new Error())})`);
            return;
        }
        if (req.method !== 'POST') {
            out.writeHead(405);
            out.end();
            console.log(`405 Method Not Allowed (${getLineNumber(new Error())})`); 
            return;
        }
        if (!params) {
            out.writeHead(400, 'Expected Type Parameter');
            out.end();
            console.log(`400 Expected Type Parameter (no query string, ${getLineNumber(new Error())})`); 
            return;
        }
        let type = params.get('type');
        if (!type) {
            out.writeHead(400, 'Expected Type Parameter');
            out.end();
            console.log(`400 Expected Type Parameter (no type parameter, ${getLineNumber(new Error())})`); 
            return;
        }
        let data = '';
        req.on('data', chunk => {
            data += String(chunk);
        });
        req.on('end', async () => {
            try {
                let ships = parseData(data);
                if (ships.length > 2048) {
                    out.writeHead(400, 'Max 2048 Ships');
                    out.end();
                    console.log(`400 Max 2048 Ships (sent ${ships.length} ships, ${getLineNumber(new Error())})`); 
                    return;
                }
                let [text, speeds] = (await addShipsToFilesWorker(type, ships, 65536, false));
                for (let [type, value] of Object.entries(speeds)) {
                    newSpeeds.push(...value.newSpeeds.map(x => [type, x[0], x[1]] as [string, string, number]));
                    improvedSpeeds.push(...value.improvedSpeeds.map(x => [type, x[0], x[1], x[2]] as [string, string, number, number]));
                    newPeriods.push(...value.newPeriods.map(x => [type, x[0], x[1]] as [string, string, number]));
                    improvedPeriods.push(...value.improvedPeriods.map(x => [type, x[0], x[1], x[2]] as [string, string, number, number]));
                }
                out.writeHead(200);
                out.write(text);
                out.end();
                updateCountFor(type);
                console.log(`200 OK (added ${ships.length} ships to type ${type})`); 
            } catch (error) {
                console.error(error);
                out.writeHead(500);
                out.end();
            }
        });
    },

    getcounts(req: IncomingMessage, params: URLSearchParams | null, out: ServerResponse<IncomingMessage>, ip: string, time: number): void {
        let value = lastGetCountsTime.get(ip);
        if (value !== undefined) {
            if (time - value < 0.3) {
                out.writeHead(429);
                out.end();
                console.log(`429 Too Many Requests (${(time - value).toFixed(3)} seconds, ${getLineNumber(new Error())})`); 
                return;
            } else {
                lastGetCountsTime.set(ip, time);
            }
        } else {
            lastGetCountsTime.set(ip, time);
        }
        if (req.method !== 'GET') {
            out.writeHead(405);
            out.end();
            console.log(`405 Method Not Allowed (${getLineNumber(new Error())})`); 
            return;
        }
        if (!params) {
            out.writeHead(400, 'Expected Type Parameter');
            out.end();
            console.log(`400 Expected Type Parameter (no query string, ${getLineNumber(new Error())})`); 
            return;
        }
        let type = params.get('type');
        if (!type) {
            out.writeHead(400, 'Expected Type Parameter');
            out.end();
            console.log(`400 Expected Type Parameter (no type parameter, ${getLineNumber(new Error())})`); 
            return;
        }
        out.writeHead(200);
        out.write(counts[type]);
        out.end();
        console.log(`200 OK (type ${type})`);
    },

    getnewships(req: IncomingMessage, params: URLSearchParams | null, out: ServerResponse<IncomingMessage>, ip: string, time: number): void {
        let value = lastGetNewShipsTIme.get(ip);
        if (value !== undefined) {
            if (time - value < 50) {
                console.log(`429 Too Many Requests (${(time - value).toFixed(3)} seconds, ${getLineNumber(new Error())})`); 
                out.writeHead(429);
                out.end();
                return;
            } else {
                lastGetNewShipsTIme.set(ip, time);
            }
        } else {
            lastGetNewShipsTIme.set(ip, time);
        }
        if (req.method !== 'GET') {
            out.writeHead(405);
            out.end();
            console.log(`405 Method Not Allowed (${getLineNumber(new Error())})`); 
            return;
        }
        if (ip !== '192.9.227.225') {
            out.writeHead(403);
            out.end();
            console.log(`403 Forbidden (${getLineNumber(new Error())})`);
            return;
        }
        out.writeHead(200);
        out.write(JSON.stringify({newSpeeds, improvedSpeeds, newPeriods, improvedPeriods}));
        out.end();
        console.log(`200 OK`);
        newSpeeds = [];
        improvedSpeeds = [];
        newPeriods = [];
        improvedPeriods = [];
    },

    getperiodmap(req: IncomingMessage, params: URLSearchParams | null, out: ServerResponse<IncomingMessage>, ip: string, time: number): void {
        let value = lastGetPeriodMapTime.get(ip);
        if (value !== undefined) {
            if (time - value < 0.5) {
                console.log(`429 Too Many Requests (${(time - value).toFixed(3)} seconds, ${getLineNumber(new Error())})`); 
                out.writeHead(429);
                out.end();
                return;
            } else {
                lastGetPeriodMapTime.set(ip, time);
            }
        } else {
            lastGetPeriodMapTime.set(ip, time);
        }
        if (req.method !== 'GET') {
            out.writeHead(405);
            out.end();
            console.log(`405 Method Not Allowed (${getLineNumber(new Error())})`); 
            return;
        }
        if (!params) {
            out.writeHead(400, 'Expected "type" And "period" Parameters');
            out.end();
            console.log(`400 Expected "type" And "period" Parameters (no query string, ${getLineNumber(new Error())})`); 
            return;
        }
        let type = params.get('type');
        let periodP = params.get('period');
        if (!type || !periodP) {
            out.writeHead(400, 'Expected "type" And "period" Parameters');
            out.end();
            console.log(`400 Expected "type" And "period" Parameters (parameters aren't present, ${getLineNumber(new Error())})`); 
            return;
        }
        let period = parseInt(periodP);
        if (Number.isNaN(period)) {
            out.writeHead(400, 'Invalid Parameters');
            out.end();
            console.log(`400 Invalid Parameters (period is invalid, ${getLineNumber(new Error())})`); 
            return;
        }
        out.writeHead(200);
        let maps = periodMaps[type];
        if (!maps || !(period in maps)) {
            out.writeHead(400, 'Invalid Parameters');
            out.end();
            console.log(`400 Invalid Parameters (period map not present, ${getLineNumber(new Error())})`); 
            return;
        }
        // out.write(periodMaps[type]);
        out.end();
        console.log(`200 OK (type ${type})`);
    },

};


let server = createServer(async (req, out) => {
    try {
        let ip = req.headers['x-forwarded-for'] as string;
        // let ip = '127.0.0.1';
        if (!ip) {
            out.writeHead(400, 'No IP address; cannot determine rate limits');
            out.end();
            return;
        }
        console.log(`${ip} ${req.method} ${req.url} HTTP/${req.httpVersion} ${req.headers['referer'] ?? '[No referer]'} ${req.headers['user-agent'] ?? '[No user agent]'}`);
        let index = ip.indexOf(',');
        if (index !== -1) {
            ip = ip.slice(0, index);
        }
        let time = performance.now() / 1000;
        if (!req.url) {
            out.writeHead(400);
            console.log(`400 Bad Request`);
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
        if (endpoint in ENDPOINTS) {
            await ENDPOINTS[endpoint](req, params, out, ip, time);
        } else {
            out.writeHead(404);
            out.end();
            console.log(`404 Not Found (endpoint does not exist, ${getLineNumber(new Error())})`); 
        }
    } catch (error) {
        console.error(error);
        if (!out.headersSent) {
            out.writeHead(500);
        }
        out.end();
    }
});

server.listen(3000, 'localhost');


function updateDataZip() {
    execSync(`${basePath}/update_data_zip`, {stdio: 'inherit'});
    execSync(`cp ${basePath}/data.zip /var/www/html/5s/data.zip`, {stdio: 'inherit'});
}

updateDataZip();
setInterval(() => updateDataZip, 3600 * 1000);

function backupDataZip() {
    execSync(`mkdir -p ${basePath}/backup && cp ${basePath}/data.zip ${basePath}/backup/data_${Math.floor(Date.now() / 1000)}.zip`, {stdio: 'inherit'});
}

backupDataZip();
setInterval(() => backupDataZip, 86400 * 4 * 1000);


async function updatePeriodMaps(): Promise<void> {
    console.log(`Updating period maps`);
    for (let type of TYPES) {
        let maps: Uint32Array[] = [];
        let entries: {[key: string]: number} = {};
        for (let category of ['orthogonal', 'diagonal', 'oblique', 'oscillator']) {
            let file = (await fs.readFile(`${basePath}/data/${type}/${category}.sss`)).toString();
            for (let ship of parseData(file)) {
                let key = ship.dx + ' ' + ship.dy + ' ' + ship.period;
                let value = ship.pop;
                if (shipIsOptimal(type, ship)) {
                    value |= (1 << 31);
                }
                entries[key] = value;
            }
        }
        for (let period = 1; period < 128; period++) {
            let map = new Uint32Array(Math.round((period + 1) * (period / 2)));
            let i = 0;
            for (let dx = 0; dx <= period; dx++) {
                for (let dy = 0; dy <= dx; dy++) {
                    let key = dx + ' ' + dy + ' ' + period;
                    map[i++] = entries[key] ?? 0;
                    i++;
                }
            }
        }
        periodMaps[type] = maps;
    }
    console.log(`Period maps update complete`);
}

updatePeriodMaps();
setInterval(() => updatePeriodMaps, 300 * 1000);
