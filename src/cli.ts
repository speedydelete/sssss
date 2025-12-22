
import * as fs from 'node:fs/promises';
import {parse} from '../lifeweb/lib/index.js';
import {parseData, patternToShip, normalizeShips, addShipsToFiles, findSpeedRLE} from './index.js';


if (process.argv[2] === 'get') {
    console.log(findSpeedRLE(process.argv.slice(3).join(' ')));
} else if (process.argv[2] === 'add') {
    addShipsToFiles(normalizeShips(parseData(process.argv.slice(3).join(' '))));
} else if (process.argv[2] === 'add_file') {
    addShipsToFiles(normalizeShips(parseData((await fs.readFile(process.argv.slice(3).join(' '))).toString())));
} else if (process.argv[2] === 'add_rle') {
    addShipsToFiles(normalizeShips([patternToShip(parse(process.argv.slice(3).join(' ')))]));
} else {
    throw new Error(`Invalid subcommand: ${process.argv[2]}`);
}
