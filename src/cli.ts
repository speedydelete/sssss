
import * as fs from 'node:fs/promises';
import {parse} from '../lifeweb/lib/index.js';
import {parseData, patternToShip, addShipsToFiles, findSpeedRLE} from './index.js';


let command = process.argv[2];
let type = process.argv[3];
let arg = process.argv.slice(4).join(' ');

let out: string;

if (command === 'get') {
    out = await findSpeedRLE(type, arg);
} else if (process.argv[2] === 'add') {
    let data = parseData((await fs.readFile(arg)).toString());
    out = await addShipsToFiles(type, data);
} else if (process.argv[2] === 'add_rle') {
    let data = patternToShip(type, parse((await fs.readFile(arg)).toString()));
    out = await addShipsToFiles(type, data);
} else {
    throw new Error(`Invalid subcommand: ${process.argv[2]}`);
}

process.stdout.write(out);
