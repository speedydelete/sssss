
import {join} from 'node:path';
import * as fs from 'node:fs/promises';
import {Pattern, parse, findType, findMinmax} from '../lifeweb/lib/index.js';


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
        let newRule = findMinmax(p, type, ship.period + 1)[0];
        p = parse(`x = 0, y = 0, rule = ${newRule}\n${ship.rle}`);
        type = findType(p, ship.period + 1);
        if (type.period !== ship.period || !type.disp || type.disp[0] !== ship.dx || type.disp[1] !== ship.dy) {
            throw new Error(`Bug in lifeweb detected with ship: ${shipsToString([ship])}`);
        }
        ship.rule = newRule;
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


export function patternToShip(p: Pattern): Ship {
    let type = findType(p, 16777216);
    if (!type.disp) {
        throw new Error('Pattern is not a ship or period is greater than 16777216 generations');
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

export async function findShip(dx: number, dy: number, period: number): Promise<Ship | null> {
    dx = Math.abs(dx);
    dy = Math.abs(dy);
    if (dx < dy) {
        let temp = dy;
        dy = dx;
        dx = temp;
    }
    let file: string;
    if (dy === 0) {
        file = join(dataPath, 'orthogonal.sss');
    } else if (dx === dy) {
        file = join(dataPath, 'diagonal.sss');
    } else {
        file = join(dataPath, 'oblique.sss');
    }
    let data = parseData((await fs.readFile(file)).toString());
    for (let ship of data) {
        if (ship.period === period && ship.dx === dx && ship.dy === dy) {
            return ship;
        }
    }
    return null;
}

export async function findSpeed(speed: string): Promise<Ship | null> {
    let {dx, dy, period} = parseSpeed(speed);
    return await findShip(dx, dy, period);
}


// let ships = parseData((await fs.readFile('data/diagonal.sss')).toString());
// ships = sortShips(ships);
// for (let i = 75000; i < ships.length + 999; i += 1000) {
//     let data = normalizeShips(ships.slice(i, i + 1000));
//     await fs.appendFile('data/diagonal_new.sss', shipsToString(data));
//     console.log(Math.min(i + 1000, ships.length) + ' ships normalized');
// }
