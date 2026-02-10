
import * as fs from 'node:fs/promises';
import {parse} from '../lifeweb/lib/index.js';
import {Ship, parseData, patternToShip, addShipsToFiles, mergeShips, findSpeedRLE} from './index.js';


let command = process.argv[2];
let type = process.argv[3];
let arg = process.argv.slice(4).join(' ');

let out: string;

if (command === 'get') {
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
} else if (process.argv[2] === 'add') {
    let data = parseData((await fs.readFile(arg)).toString());
    out = (await addShipsToFiles(type, data))[0];
} else if (process.argv[2] === 'add_rle') {
    let data: Ship[] = [];
    for (let rle of (await fs.readFile(arg)).toString().split('!')) {
        rle = rle.trim();
        if (rle === '') {
            continue;
        }
        data.push(...patternToShip(type, parse(rle + '!'), 1048576));
    }
    out = (await addShipsToFiles(type, data))[0];
} else if (process.argv[2] === 'merge') {
    let data = parseData((await fs.readFile(arg)).toString());
    out = (await mergeShips(type, data))[0];
} else {
    throw new Error(`Invalid subcommand: ${process.argv[2]}`);
}

process.stdout.write(out);
