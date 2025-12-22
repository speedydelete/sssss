
import {join} from 'node:path';
import * as fs from 'node:fs/promises';
import {Pattern, parse, findType, findMinmax} from '../lifeweb/lib/index.js';
import {createAdjustable} from './adjustable.js';


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
        line = line.trim();
        if (line === '' || line.startsWith('#')) {
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

export function normalizeShips<T extends boolean | undefined = undefined>(ships: Ship[], throwInvalid?: T): T extends false ? [Ship[], string[]] : Ship[] {
    let out: Ship[] = [];
    let invalidShips: string[] = [];
    for (let i = 0; i < ships.length; i++) {
        let ship = ships[i];
        let p = parse(`x = 0, y = 0, rule = ${ship.rule}\n${ship.rle}`);
        let type = findType(p, ship.period + 1);
        if (type.period !== ship.period || !type.disp || !(Math.abs(ship.dx) === Math.abs(type.disp[0]) ? Math.abs(ship.dy) === Math.abs(type.disp[1]) : (Math.abs(ship.dy) === Math.abs(type.disp[0]) && Math.abs(ship.dx) === Math.abs(type.disp[1])))) {
            if (throwInvalid) {
                throw new Error(`Invalid ship detected: ${shipsToString([ship]).slice(0, -1)}`);
            } else {
                console.log(`Invalid ship detected: ${shipsToString([ship]).slice(0, -1)}`);
                invalidShips.push(speedToString(ship));
                continue;
            }
        }
        ship.dx = type.disp[0];
        ship.dy = type.disp[1];
        if (ship.dx === 0 && ship.dy !== 0) {
            p.rotateRight();
            ship.dx = -ship.dy;
            ship.dy = 0;
            type = findType(p, ship.period + 1);
            if (type.period !== ship.period || !type.disp || ship.dx !== type.disp[0] || ship.dy !== type.disp[1]) {
                if (throwInvalid) {
                    throw new Error(`Invalid ship detected: ${shipsToString([ship]).slice(0, -1)}`);
                } else {
                    console.log(`Invalid ship detected: ${shipsToString([ship]).slice(0, -1)}`);
                    invalidShips.push(speedToString(ship));
                    continue;
                }
            }
        }
        if (ship.dx < 0 || ship.dy < 0 || Math.abs(ship.dx) < Math.abs(ship.dy)) {
            if (ship.dx < 0) {
                p.flipHorizontal();
                ship.dx = -ship.dx;
            }
            if (ship.dy < 0) {
                p.flipVertical();
                ship.dy = -ship.dy;
            }
            if (ship.dx < ship.dy) {
                let temp = ship.dx;
                ship.dx = ship.dy;
                ship.dy = temp;
                p.rotateLeft().flipVertical();
            }
            type = findType(p, ship.period + 1);
            if (type.period !== ship.period || !type.disp || ship.dx !== type.disp[0] || ship.dy !== type.disp[1]) {
                if (throwInvalid) {
                    throw new Error(`Invalid ship detected: ${shipsToString([ship]).slice(0, -1)}`);
                } else {
                    console.log(`Invalid ship detected: ${shipsToString([ship]).slice(0, -1)}`);
                    invalidShips.push(speedToString(ship));
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
    }
    // @ts-ignore
    return throwInvalid === false ? [out, invalidShips] : out;
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
        rle: p.toRLE().split('\n').slice(1).join(''),
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
            return `c/${period}o`;
        } else {
            return `${dx}c/${period}o`;
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


// @ts-ignore
let dataPath = join(import.meta.dirname, '..', 'data');

export async function addShipsToFiles(ships: Ship[]): Promise<string> {
    let [ships2, invalidShips] = normalizeShips(ships, false);
    let orthogonals: Ship[] = [];
    let diagonals: Ship[] = [];
    let obliques: Ship[] = [];
    for (let ship of ships2) {
        if (ship.dy === 0) {
            orthogonals.push(ship);
        } else if (ship.dx === ship.dy) {
            diagonals.push(ship);
        } else {
            obliques.push(ship);
        }
    }
    let improvedShips: string[] = [];
    let unchangedShips: string[] = [];
    let newShips: string[] = [];
    for (let [part, name] of [[orthogonals, 'orthogonal'], [diagonals, 'diagonal'], [obliques, 'oblique']] as const) {
        let data = parseData((await fs.readFile(join(dataPath, name + '.sss'))).toString());
        for (let ship of part) {
            let found = false;
            for (let ship2 of data) {
                if (ship2.period === ship.period && ship2.dx === ship.dx && ship2.dy === ship.dy) {
                    if (ship.pop < ship2.pop) {
                        ship2.pop = ship.pop;
                        ship2.rule = ship.rule;
                        ship2.rle = ship.rle;
                        improvedShips.push(speedToString(ship));
                    } else {
                        unchangedShips.push(speedToString(ship));
                    }
                    found = true;
                    break;
                }
            }
            if (!found) {
                data.push(ship);
                newShips.push(speedToString(ship));
            }
        }
        data = sortShips(data);
        await fs.writeFile(join(dataPath, name + '.sss'), shipsToString(data));
    }
    let out = '';
    if (invalidShips.length > 0) {
        out += `${invalidShips.length} invalid ships: ${invalidShips.join(', ')}\n`;
    }
    if (newShips.length > 0) {
        out += `${newShips.length} new ships: ${newShips.join(', ')}\n`;
    }
    if (improvedShips.length > 0) {
        out += `${improvedShips.length} improved ships: ${improvedShips.join(', ')}\n`;
    }
    if (unchangedShips.length > 0) {
        out += `${unchangedShips.length} unchanged ships: ${unchangedShips.join(', ')}\n`;
    }
    if (invalidShips.length === 0 && newShips.length === 0 && improvedShips.length === 0 && unchangedShips.length === 0) {
        out = 'No changes made\n';
    }
    return out;
}


export async function findNonAdjustableShip(dx: number, dy: number, period: number): Promise<Ship | null> {
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
            return ship;
        }
    }
    return null;
}

export function findAdjustableShip(dx: number, dy: number, period: number): Ship | null {
    let p = createAdjustable(dx, dy, period);
    if (!p) {
        return null;
    }
    return normalizeShips([{
        pop: 0,
        rule: p.ruleStr,
        dx,
        dy,
        period,
        rle: p.toRLE().split('\n').slice(1).join(''),
    }])[0];
}

export async function findShip(dx: number, dy: number, period: number): Promise<{normal: Ship | null, adjustable: Ship | null}> {
    return {normal: await findNonAdjustableShip(dx, dy, period), adjustable: findAdjustableShip(dx, dy, period)};
}


export async function findSpeedRLE(speed: string): Promise<string> {
    let {dx, dy, period} = parseSpeed(speed);
    let data = await findShip(dx, dy, period);
    let {normal, adjustable} = data;
    if (!normal && !adjustable) {
        if (dx + dy < period / 2) {
            return `No such ship found in database!\nNote that a 61-cell RCT-based ship that moves at this speed exists.\n`;
        } else {
            return `No such ship found in database!\n`;
        }
    }
    let out = `#C (${dx}, ${dy})/${period}`;
    let pop = normal ? normal.pop : (adjustable ? adjustable.pop : 0);
    if (normal) {
        out += ` population ${normal.pop}\nx = 0, y = 0, rule = ${normal.rule}\n${normal.rle}\n`;
    }
    if (adjustable && !(normal && adjustable.pop >= normal.pop)) {
        if (normal) {
            out += `\nFound an adjustable spaceship with lower population!\n#C (${dx}, ${dy})/${period}, population ${adjustable.pop}\n`;
            pop = adjustable.pop;
        } else {
            out = `\nUnable to find a non-adjustable ship, but found an adjustable ship!\n${out} population ${adjustable.pop}\n`;
        }
        out += `x = 0, y = 0, rule = ${adjustable.rule}\n${adjustable.rle}\n`;
    }
    if (dx + dy < period / 2 && pop > 61) {
        out += `\n\nNote that a 61-cell RCT-based ship that moves at this speed exists.\n`;
    }
    return out;
}
