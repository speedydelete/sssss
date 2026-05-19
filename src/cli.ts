
import * as fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {parse} from '../lifeweb/lib/index.js';
import {Type, TYPES, Ship, parseData, patternToShip, addShipsToFiles, mergeShips, findSpeedRLE} from './index.js';


if (process.argv[2] === 'randomsearch') {
    await import('./randomsearch.js');
    process.exit(0);
} else if (process.argv[2] === 'prove' || process.argv[2] === 'prove_enumerate' || process.argv[2] === 'prove_run') {
    await import('./prover.js');
    process.exit(0);
}

let cmd = process.argv[2];
let type = process.argv[3] as Type;
let arg = process.argv.slice(4).join(' ');

if (!TYPES.includes(type)) {
    throw new Error(`Invalid type: '${type}'`);
}

let out: string;

if (cmd === 'get') {
    let adjustables: 'yes' | 'no' | 'only' = 'yes';
    if (arg.endsWith('yes')) {
        arg = arg.slice(0, -3);
    } else if (arg.endsWith('no')) {
        arg = arg.slice(0, -2);
        adjustables = 'no';
    } else if (arg.endsWith('only')) {
        arg = arg.slice(0, -4);
        adjustables = 'only';
    }
    out = await findSpeedRLE(type, arg, adjustables);
} else if (cmd === 'add') {
    let data = parseData((await fs.readFile(arg)).toString());
    out = (await addShipsToFiles(type, data))[0];
} else if (cmd === 'add_rle') {
    let data: Ship[] = [];
    for (let rle of (await fs.readFile(arg)).toString().split('!')) {
        rle = rle.trim();
        if (rle === '') {
            continue;
        }
        data.push(...patternToShip(type, parse(rle + '!'), 1048576));
    }
    out = (await addShipsToFiles(type, data))[0];
} else if (cmd === 'merge') {
    let data = parseData((await fs.readFile(arg)).toString());
    out = (await mergeShips(type, data))[0];
} else if (cmd === 'get_admin_key') {
    let key = process.argv.slice(3).join(' ');
    out = crypto.createHash('sha3-256').update(key, 'utf-8').digest('hex');
} else {
    throw new Error(`Invalid subcommand: ${process.argv[2]}`);
}

process.stdout.write(out);
