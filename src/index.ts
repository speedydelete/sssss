
import {join} from 'node:path';
import * as fs from 'node:fs/promises';
import {Pattern, parse, findType, findMinmax, fullIdentify} from '../lifeweb/lib/index.js';
import {ADJUSTABLE_SHIPS} from './adjustable.js';


export interface Ship {
    pop: number;
    rule: string;
    dx: number;
    dy: number;
    period: number;
    rle: string;
}

export function parseData(data: string): Ship[] {
    let out: Ship[] = [];
    for (let line of data.split('\n')) {
        if (line.startsWith('#')) {
            continue;
        }
        line = line.trim();
        if (line.length === 0) {
            continue;
        }
        let info = line.split(', ');
        out.push({
            pop: parseInt(info[0]),
            rule: info[1],
            dx: parseInt(info[2]),
            dy: parseInt(info[3]),
            period: parseInt(info[4]),
            rle: info[5],
        });
    }
    return out;
}

export function shipsToString(ships: Ship[]): string {
    let out = '';
    for (let ship of ships) {
        out += ship.pop + ', ' + ship.rule + ', ' + ship.dx + ', ' + ship.dy + ', ' + ship.period + ', ' + ship.rle + '\n';
    }
    return out;
}


export function sortShips(ships: Ship[]): Ship[] {
    return ships.sort((a, b) => {
        if (a.period < b.period) {
            return -1;
        } else if (a.period > b.period) {
            return 1;
        } else {
            if (a.dx > b.dx) {
                return -1;
            } else if (a.dx < b.dx) {
                return 1;
            } else {
                return b.dy - a.dy;
            }
        }
    });
}

export function normalizeShips(ships: Ship[], throwInvalid: boolean = true): Ship[] {
    let out: Ship[] = [];
    for (let i = 0; i < ships.length; i++) {
        let ship = ships[i];
        let p = parse(`x = 0, y = 0, rule = ${ship.rule}\n${ship.rle}`);
        let type = findType(p, ship.period + 1);
        if (type.period !== ship.period || !type.disp || type.disp[0] !== ship.dx || type.disp[1] !== ship.dy) {
            if (throwInvalid) {
                throw new Error(`Invalid ship detected: ${shipsToString([ship])}`);
            } else {
                console.error(`Invalid ship detected: ${shipsToString([ship])}`);
                continue;
            }
        }
        if (ship.dx < 0 || ship.dy < 0 || Math.abs(ship.dx) < Math.abs(ship.dy)) {
            if (ship.dx < 0) {
                p.flipHorizontal();
            }
            if (ship.dy < 0) {
                p.flipVertical();
            }
            if (ship.dx < ship.dy) {
                let temp = ship.dx;
                ship.dx = ship.dy;
                ship.dy = temp;
                p.rotateLeft().flipVertical();
            }
            type = findType(p, ship.period + 1);
            if (type.period !== ship.period || !type.disp || type.disp[0] !== ship.dx || type.disp[1] !== ship.dy) {
                if (throwInvalid) {
                    throw new Error(`Invalid ship detected: ${shipsToString([ship])}`);
                } else {
                    console.error(`Invalid ship detected: ${shipsToString([ship])}`);
                    continue;
                }
            }
        }
        ship.rule = findMinmax(p, ship.period + 1)[0];
        let minPop = type.phases[0].population;
        let minPhase = type.phases[0];
        for (let phase of type.phases) {
            if (phase.population < minPop) {
                minPop = phase.population;
                minPhase = phase;
            }
        }
        ship.rle = minPhase.toRLE().split('\n').slice(1).join('');
        out.push(ship);
        if (i > 0 && i % 1000 === 0) {
            console.log(i + ' ships normalized');
        }
    }
    return out;
}


export function patternToShip(p: Pattern, limit: number = 32768): Ship {
    let type = findType(p, limit);
    if (!type.disp) {
        throw new Error(`Pattern is not a ship or its period is greater than ${limit} generations`);
    }
    if (type.disp[0] === 0 && type.disp[1] === 0) {
        throw new Error('Pattern does not move');
    }
    return normalizeShips([{
        pop: p.population,
        rule: p.ruleStr,
        dx: type.disp[0],
        dy: type.disp[1],
        period: type.period,
        rle: p.toRLE(),
    }])[0];
}


export function parseSpeed(speed: string): {dx: number, dy: number, period: number} {
    if (!speed.includes('c')) {
        throw new Error('Invalid speed!');
    }
    let [disp, period] = speed.split('c');
    if (period.startsWith('/')) {
        period = period.slice(1);
    }
    let p = parseInt(period);
    let x: number;
    let y: number;
    let num = parseInt(disp);
    if (!Number.isNaN(num)) {
        x = num;
        if (period.endsWith('d')) {
            y = num;
        } else {
            y = 0;
        }
    } else if (disp.startsWith('(')) {
        let parts = disp.slice(1, -1).split(',');
        x = parseInt(parts[0]);
        y = parseInt(parts[1]);
        if (Number.isNaN(x) || Number.isNaN(y) || parts.length !== 2) {
            throw new Error('Invalid speed!');
        }
    } else if (disp === '') {
        x = 1;
        if (period.endsWith('d')) {
            y = 1;
        } else {
            y = 0;
        }
    } else {
        throw new Error('Invalid speed!');
    }
    return {dx: x, dy: y, period: p};
}

export function speedToString({dx, dy, period}: {dx: number, dy: number, period: number}): string {
    if (dy === 0) {
        if (dx === 1) {
            return `c/${period}o`
        } else {
            return `${dx}c/${period}p`
        }
    } else if (dx === dy) {
        if (dx === 1) {
            return `c/${period}d`;
        } else {
            return `${dx}c/${period}d`;
        }
    } else {
        return `(${dx}, ${dy})c/${period}`;
    }
}


let dataPath = join(import.meta.dirname, '..', 'data');

export async function addShipsToFiles(ships: Ship[]): Promise<string[]> {
    let orthogonals: Ship[] = [];
    let diagonals: Ship[] = [];
    let obliques: Ship[] = [];
    for (let ship of ships) {
        if (ship.dy === 0) {
            orthogonals.push(ship);
        } else if (ship.dx === ship.dy) {
            diagonals.push(ship);
        } else {
            obliques.push(ship);
        }
    }
    let errors: string[] = [];
    if (orthogonals.length > 0) {
        let data = parseData((await fs.readFile(join(dataPath, 'orthogonal.sss'))).toString());
        for (let ship of orthogonals) {
            let found = false;
            for (let ship2 of data) {
                if (ship2.period === ship.period && ship2.dx === ship.dx && ship2.dy === ship.dy) {
                    if (ship.pop < ship2.pop) {
                        ship2.pop = ship.pop;
                        ship2.rule = ship.rule;
                        ship2.rle = ship.rle;
                    } else {
                        errors.push(`Didn't add ${speedToString(ship)} because there is another ship known with less population!`);
                        found = true;
                        break;
                    }
                }
            }
            if (!found) {
                data.push(ship);
            }
        }
        data = sortShips(data);
        await fs.writeFile(join(dataPath, 'orthogonal.sss'), shipsToString(data));
    }
    if (diagonals.length > 0) {
        let data = parseData((await fs.readFile(join(dataPath, 'diagonal.sss'))).toString());
        for (let ship of diagonals) {
            let found = false;
            for (let ship2 of data) {
                if (ship2.period === ship.period && ship2.dx === ship.dx && ship2.dy === ship.dy) {
                    if (ship.pop < ship2.pop) {
                        ship2.pop = ship.pop;
                        ship2.rule = ship.rule;
                        ship2.rle = ship.rle;
                    } else {
                        errors.push(`Didn't add ${speedToString(ship)} because there is another ship known with less population!`);
                        found = true;
                        break;
                    }
                }
            }
            if (!found) {
                data.push(ship);
            }
        }
        data = sortShips(data);
        await fs.writeFile(join(dataPath, 'diagonal.sss'), shipsToString(data));
    }
    if (obliques.length > 0) {
        let data = parseData((await fs.readFile(join(dataPath, 'oblique.sss'))).toString());
        for (let ship of obliques) {
            let found = false;
            for (let ship2 of data) {
                if (ship2.period === ship.period && ship2.dx === ship.dx && ship2.dy === ship.dy) {
                    if (ship.pop < ship2.pop) {
                        ship2.pop = ship.pop;
                        ship2.rule = ship.rule;
                        ship2.rle = ship.rle;
                    } else {
                        errors.push(`Didn't add ${speedToString(ship)} because there is another ship known with less population!`);
                        found = true;
                        break;
                    }
                }
            }
            if (!found) {
                data.push(ship);
            }
        }
        data = sortShips(data);
        await fs.writeFile(join(dataPath, 'oblique.sss'), shipsToString(data));
    }
    return errors;
}

export async function findShip(dx: number, dy: number, period: number, adjustable: boolean = true): Promise<null | {ship: Ship, adjustable: boolean}> {
    dx = Math.abs(dx);
    dy = Math.abs(dy);
    if (dx < dy) {
        let temp = dy;
        dy = dx;
        dx = temp;
    }
    let type: 'orthogonal' | 'diagonal' | 'oblique';
    if (dy === 0) {
        type = 'orthogonal';
    } else if (dx === dy) {
        type = 'diagonal';
    } else {
        type = 'oblique';
    }
    let data = parseData((await fs.readFile(join(dataPath, type + '.sss'))).toString());
    for (let ship of data) {
        if (ship.period === period && ship.dx === dx && ship.dy === dy) {
            return {ship, adjustable: false};
        }
    }
    if (adjustable) {
        let record: Ship | null = null;
        for (let i = 0; i < ADJUSTABLE_SHIPS.length; i++) {
            let out = ADJUSTABLE_SHIPS[i](dx, dy, period);
            if (out) {
                let data = fullIdentify(out, period + 1, 1);
                if (!data.disp) {
                    throw new Error(`Invalid adjustable ship found! (#${i})`)
                }
                let p = data.phases[data.stabilizedAt + 1];
                let ship = normalizeShips([{
                    pop: 0,
                    rule: p.ruleStr,
                    dx,
                    dy,
                    period,
                    rle: p.toRLE(),
                }])[0];
                if (!record || ship.pop < record.pop) {
                    record = ship;
                }
            }
        }
        if (record) {
            return {ship: record, adjustable: true};
        } else {
            return null;
        }
    } else {
        return null;
    }
}

export async function findSpeedRLE(speed: string): Promise<string> {
    let {dx, dy, period} = parseSpeed(speed);
    let data = await findShip(dx, dy, period);
    if (!data) {
        if (dx + dy < 2 * period) {
            return `No such ship found in database!\nNote that a 61-cell RCT-based ship that moves at this speed exists\n`;
        } else {
            return `No such ship found in database!`;
        }
    }
    let {ship, adjustable} = data;
    let out = `#C (${ship.dx}, ${ship.dy})c/${ship.period}, population ${ship.pop}\n`;
    if (adjustable) {
        out = '#C Unable to find a non-adjustable ship, but found an adjustable ship!\n' + out;
    }
    if (dx + dy < 2 * period && ship.pop > 61) {
        out += `#C Note that a 61-cell RCT-based ship that moves at this speed exists\n`;
    }
    return out + '\n' + ship.rle;
}


let errors = 0;

let oldShips = parseData((await fs.readFile('data/oblique.sss')).toString());
let newShips = parseData((await fs.readFile('new.sss')).toString());

// console.log('Checking new ships');
// let start = performance.now();

// for (let i = 0; i < newShips.length; i++) {
//     let {period, dx, dy} = newShips[i];
//     let index = newShips.slice(i + 1).findIndex(x => x.period === period && x.dx === dx && x.dy === dy);
//     let dupeCount = 0;
//     while (index !== -1) {
//         dupeCount++;
//         newShips.splice(index + i + 1, 1);
//         index = newShips.slice(i + 1).findIndex(x => x.period === period && x.dx === dx && x.dy === dy);
//     }
//     if (dupeCount > 0) {
//         await fs.appendFile('out.txt', `Line repeated ${dupeCount} ${dupeCount === 1 ? 'time' : 'times'}: ${dx}, ${dy}, ${period}\n`);
//         errors += dupeCount;
//     }
//     if (i % 5000 === 0 && i > 0) {
//         console.log(`${i} ships checked (${(i / ((performance.now() - start) / 1000)).toFixed(3)} ships/second), ${errors} errors found`);
//         await fs.writeFile('new.sss', shipsToString(sortShips(newShips)));
//     }
// }
// console.log(`${newShips.length} ships checked (${(newShips.length / ((performance.now() - start) / 1000)).toFixed(3)} ships/second), ${errors} errors found`);

// await fs.writeFile('new.sss', shipsToString(sortShips(newShips)));

console.log('Checking old ships');
let start = performance.now();

for (let i = 0; i < oldShips.length; i++) {
    let {dx, dy, period} = oldShips[i];
    if (!newShips.some(x => x.period === period && x.dx === dx && x.dy === dy)) {
        await fs.appendFile('out.txt', `Missing line: ${dx}, ${dy}, ${period}\n`);
        let ship = normalizeShips([oldShips[i]], true);
        newShips.push(...ship);
        errors++;
    }
    if (i % 5000 === 0 && i > 0) {
        console.log(`${i} ships checked (${(i / ((performance.now() - start) / 1000)).toFixed(3)} ships/second), ${errors} errors found`);
        await fs.writeFile('new2.sss', shipsToString(sortShips(newShips)));
    }
}
console.log(`${oldShips.length} ships checked (${(oldShips.length / ((performance.now() - start) / 1000)).toFixed(3)} ships/second), ${errors} errors found`);
await fs.writeFile('new2.sss', shipsToString(sortShips(newShips)));

// let ships = parseData((await fs.readFile('data/oblique.sss')).toString());
// ships = sortShips(ships);
// let start = performance.now();
// let count = 0;
// let inc = 10;
// for (let i = 0; i < ships.length; i += inc) {
//     let subStart = performance.now();
//     let data = normalizeShips(ships.slice(i, i + inc));
//     await fs.appendFile('data/oblique_new.sss', shipsToString(data));
//     count += inc;
//     let now = performance.now();
//     let sps = inc / ((now - subStart) / 1000);
//     console.log(`${Math.min(i + inc, ships.length)} ships normalized (${sps.toFixed(3)} ships/second current, ${(count / ((now  - start) / 1000)).toFixed(3)} ships/second total)`);
//     inc = Math.max(Math.min(Math.ceil(sps * 10), 1000), 1);
// }
