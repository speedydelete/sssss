
import * as fs from 'node:fs/promises';
import {execSync} from 'node:child_process';
import {parseSpeed, parse} from '../lifeweb/lib/index.js';
import {Type, TYPES, Ship, parseShips, patternToShip, addShipsToFiles, findSpeedRLE} from './index.js';


if (process.argv[2] === 'randomsearch') {
    await import('./randomsearch.js');
    process.exit(0);
// } else if (process.argv[2] === 'prove' || process.argv[2] === 'prove_enumerate' || process.argv[2] === 'prove_run') {
//     await import('./prover.js');
//     process.exit(0);
} else if (process.argv[2] === 'prove') {
    let lls = process.argv[3];
    let {dx, dy, period} = parseSpeed(process.argv[4]);
    let maxBB = period * 2 + 4;
    let args = `-r 'pB1-c2345678/S012345678' -c -b ${maxBB} ${maxBB} -s p${period} x${dx} y${dy} -p '<4'`;
    console.log(`./lls ${args}`);
    execSync(`${lls} ${args}`, {stdio: 'inherit'});
    console.log(`\n./lls ${args}`);
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
} else if (cmd === 'add' || cmd === 'add_no_verify') {
    let data = parseShips((await fs.readFile(arg)).toString());
    out = (await addShipsToFiles(type, data, undefined, true, cmd === 'add'))[0];
} else if (cmd === 'add_rle' || cmd === 'add_rle_no_verify') {
    let data: Ship[] = [];
    for (let rle of (await fs.readFile(arg)).toString().split('!')) {
        rle = rle.trim();
        if (rle === '') {
            continue;
        }
        data.push(patternToShip(type, parse(rle + '!'), 1048576));
    }
    out = (await addShipsToFiles(type, data, undefined, true, cmd === 'add_rle'))[0];
} else {
    throw new Error(`Invalid subcommand: ${process.argv[2]}`);
}

process.stdout.write(out);
