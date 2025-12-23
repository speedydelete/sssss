
import * as fs from 'node:fs/promises';
import {parse} from '../lifeweb/lib/index.js';
import {parseData, patternToShip, normalizeShips, addShipsToFiles, findSpeedRLE} from './index.js';


let start = performance.now();

let command = process.argv[2];
let type = process.argv[3];
let arg = process.argv.slice(4).join(' ');

let out: string;

if (command === 'get') {
    out = await findSpeedRLE(type, arg);
} else if (process.argv[2] === 'add') {
    out = await addShipsToFiles(type, normalizeShips(parseData(arg)));
} else if (process.argv[2] === 'add_file') {
    out = await addShipsToFiles(type, normalizeShips(parseData((await fs.readFile(arg)).toString())));
} else if (process.argv[2] === 'add_rle') {
    out = await addShipsToFiles(type, normalizeShips([patternToShip(parse(arg))]));
} else if (process.argv[2] === 'add_rle_file') {
    out = await addShipsToFiles(type, normalizeShips([patternToShip(parse((await fs.readFile(arg)).toString()))]));
} else {
    throw new Error(`Invalid subcommand: ${process.argv[2]}`);
}

process.stdout.write(out);

console.log((performance.now() - start) / 1000);
