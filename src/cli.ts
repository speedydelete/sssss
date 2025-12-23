
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
    let data = parseData((await fs.readFile(arg)).toString());
    out = await addShipsToFiles(type, normalizeShips(data));
} else if (process.argv[2] === 'add_rle') {
    let data = patternToShip(parse((await fs.readFile(arg)).toString()));
    if (!data) {
        out = '';
    } else {
        let ships = normalizeShips([data]);
        if (ships.length > 0) {
            out = await addShipsToFiles(type, ships);
        } else {
            out = '';
        }
    }

} else {
    throw new Error(`Invalid subcommand: ${process.argv[2]}`);
}

process.stdout.write(out);

console.log((performance.now() - start) / 1000);
