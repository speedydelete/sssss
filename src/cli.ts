
import * as fs from 'node:fs/promises';
import {parse} from '../lifeweb/lib/index.js';
import {parseData, patternToShip, normalizeShips, addShipsToFiles, findSpeedRLE} from './index.js';


let arg = process.argv.slice(3).join(' ');

if (process.argv[2] === 'get') {
    process.stdout.write(await findSpeedRLE(arg));
} else if (process.argv[2] === 'add') {
    process.stdout.write(await addShipsToFiles(normalizeShips(parseData(arg))));
} else if (process.argv[2] === 'add_file') {
    process.stdout.write(await addShipsToFiles(normalizeShips(parseData((await fs.readFile(arg)).toString()))));
} else if (process.argv[2] === 'add_rle') {
    process.stdout.write(await addShipsToFiles(normalizeShips([patternToShip(parse(arg))])));
} else {
    throw new Error(`Invalid subcommand: ${process.argv[2]}`);
}
