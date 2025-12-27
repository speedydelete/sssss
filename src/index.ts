
import {join} from 'node:path';
import * as fs from 'node:fs/promises';
import {Pattern, TRANSITIONS, VALID_TRANSITIONS, unparseTransitions, arrayToTransitions, MAPPattern, MAPB0Pattern, MAPGenPattern, MAPB0GenPattern, findType, findMinmax, createPattern, parse, parseSpeed, speedToString} from '../lifeweb/lib/index.js';


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
        if (!info[5]) {
            continue;
        }
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


export function removeDuplicateShips(ships: Ship[]): Ship[] {
    ships = sortShips(ships);
    let out: Ship[] = [ships[0]];
    let prev = ships[0];
    for (let ship of ships.slice(1)) {
        if (prev.dx === ship.dx && prev.dy === ship.dy && prev.period === ship.period) {
            if (prev.pop <= ship.pop) {
                continue;
            } else {
                out.pop();
            }
        }
        out.push(ship);
        prev = ship;
    }
    return out;
}

export function normalizeShips<T extends boolean | undefined = undefined>(type: string, ships: Ship[], throwInvalid?: T, globalLimit?: number): T extends false ? [Ship[], string[]] : Ship[] {
    let isOT = type.startsWith('ot');
    let out: Ship[] = [];
    let invalidShips: string[] = [];
    for (let i = 0; i < ships.length; i++) {
        let ship = ships[i];
        let p = parse(`x = 0, y = 0, rule = ${ship.rule}\n${ship.rle}`);
        let limit = Math.ceil(ship.period / p.rulePeriod) * p.rulePeriod + 1;
        if (globalLimit !== undefined) {
            limit = Math.min(limit, globalLimit);
        }
        let type = findType(p, limit);
        p.run(type.stabilizedAt);
        if (!type.disp || (type.disp[0] === 0 && type.disp[1] === 0)) {
            if (throwInvalid) {
                throw new Error(`Invalid ship detected: ${shipsToString([ship]).slice(0, -1)}`);
            } else {
                console.log(`Invalid ship detected: ${shipsToString([ship]).slice(0, -1)}`);
                invalidShips.push(speedToString(ship));
                continue;
            }
        }
        if (ship.dx !== type.disp[0] || ship.dy !== type.disp[1] || ship.period !== type.period) {
            console.log(`Warning: Replacing ${speedToString(ship)} with ${speedToString({dx: type.disp[0], dy: type.disp[1], period: type.period})}`);
        }
        ship.dx = type.disp[0];
        ship.dy = type.disp[1];
        if (ship.dx === 0 && ship.dy !== 0) {
            p.rotateRight();
            ship.dx = -ship.dy;
            ship.dy = 0;
            type = findType(p, limit, false);
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
            type = findType(p, limit, false);
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
        ship.rule = findMinmax(p, limit, undefined, undefined, isOT)[0];
        if (p instanceof MAPB0Pattern || p instanceof MAPB0GenPattern) {
            let minPop = type.phases[0].population;
            let minPhase = type.phases[0];
            let evenRule = ship.rule;
            let [bTrs, sTrs] = arrayToTransitions(p.evenTrs.reverse(), TRANSITIONS);
            let bStr = unparseTransitions(bTrs, VALID_TRANSITIONS, false);
            let sStr = unparseTransitions(sTrs, VALID_TRANSITIONS, false);
            let oddRule: string;
            if (p instanceof MAPB0Pattern) {
                oddRule = `B${bStr}/S${sStr}`;
            } else {
                oddRule = `${sStr}/${bStr}/${p.states}`;
            }
            for (let i = 0; i < type.phases.length; i++) {
                let phase = type.phases[i];
                if (phase.population < minPop) {
                    minPop = phase.population;
                    minPhase = phase;
                    ship.rule = i % 2 === 0 ? evenRule : oddRule;
                }
            }
            ship.pop = minPop;
            ship.rle = minPhase.toRLE().split('\n').slice(1).join('');
            if (ship.rule === oddRule) {
                p = parse(`x = 0, y = 0, rule = ${ship.rule}\n${ship.rle}`);
                ship.rule = findMinmax(p, limit, undefined, undefined, isOT)[0];
            }
        } else {
            let minPop = type.phases[0].population;
            let minPhase = type.phases[0];
            for (let i = 0; i < type.phases.length; i++) {
                let phase = type.phases[i];
                if (phase.population < minPop) {
                    minPop = phase.population;
                    minPhase = phase;
                }
            }
            ship.pop = minPop;
            ship.rle = minPhase.toRLE().split('\n').slice(1).join('');
        }
        out.push(ship);
        if (i % 20 === 0 && i > 0) {
            console.log(`${i}/${ships.length} ships normalized`);
        }
    }
    out = removeDuplicateShips(out);
    // @ts-ignore
    return throwInvalid === false ? [out, invalidShips] : out;
}


export function patternToShip(type: string, p: Pattern, limit: number = 32768): Ship[] {
    let data = findType(p, limit);
    p.run(data.stabilizedAt);
    if (!data.disp) {
        throw new Error(`Pattern is not a ship or its period is greater than ${limit} generations`);
    }
    if (data.disp[0] === 0 && data.disp[1] === 0) {
        throw new Error('Pattern does not move');
    }
    return normalizeShips(type, [{
        pop: p.population,
        rule: p.ruleStr,
        dx: data.disp[0],
        dy: data.disp[1],
        period: data.period,
        rle: p.toRLE().split('\n').slice(1).join(''),
    }], true);
}


function validateType(type: string, ship: Ship): void {
    let correct = false;
    let p = createPattern(ship.rule);
    if (type === 'int') {
        if (p instanceof MAPPattern && p.ruleSymmetry === 'D8') {
            correct = true;
        }
    } else if (type === 'intb0') {
        if (p instanceof MAPB0Pattern && p.ruleSymmetry === 'D8') {
            correct = true;
        }
    } else if (type === 'ot') {
        if (p instanceof MAPPattern && p.ruleStr.match(/^B[1-8]*\/S[0-8]*$/)) {
            correct = true;
        }
    } else if (type === 'otb0') {
        if (p instanceof MAPB0Pattern && p.ruleStr.match(/^B0[1-8]*\/S[0-8]*$/)) {
            correct = true;
        }
    } else if (type === 'intgen') {
        if (p instanceof MAPGenPattern && p.ruleSymmetry === 'D8') {
            correct = true;
        }
    } else if (type === 'intgenb0') {
        if (p instanceof MAPB0GenPattern && p.ruleSymmetry === 'D8') {
            correct = true;
        }
    } else if (type === 'otgen') {
        if (p instanceof MAPGenPattern && p.ruleStr.match(/^[0-8]*\/[1-8]*\/\d+$/)) {
            correct = true;
        }
    } else if (type === 'otgenb0') {
        if (p instanceof MAPB0GenPattern && p.ruleStr.match(/^[0-8]*\/0[1-8]*\/\d+$/)) {
            correct = true;
        }
    } else {
        throw new Error(`Invalid ship type: '${type}'`);
    }
    if (!correct) {
        throw new Error(`Invalid rule for ${type}: ${ship.rule}`);
    }
}


let dataPath = join(import.meta.dirname, '..', 'data');

// function compareShips(x: Ship, y: Ship): number {
//     if (x.period !== y.period) {
//         return x.period - y.period;
//     } else if (x.dx !== y.dx) {
//         return x.dx - y.dx;
//     } else {
//         return x.dy - y.dy;
//     }
// }

export async function addShipsToFiles(type: string, ships: Ship[], limit?: number): Promise<string> {
    let start = performance.now();
    let [ships2, invalidShips] = normalizeShips(type, ships, false, limit);
    // let ships2 = ships;
    // let invalidShips: Ship[] = [];
    let orthogonals: Ship[] = [];
    let diagonals: Ship[] = [];
    let obliques: Ship[] = [];
    for (let ship of ships2) {
        validateType(type, ship);
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
        if (part.length === 0) {
            continue;
        }
        if (part.length > 100) {
            console.log('Adding ' + name + 's');
        }
        let data = parseData((await fs.readFile(join(dataPath, type, name + '.sss'))).toString());
        // for (let i = 0; i < part.length; i++) {
        //     if (i % 100 === 0 && i > 0) {
        //         console.log(`${i}/${part.length} ships added`);
        //     }
        //     let ship = part[i];
        // // for (let ship of part) {
        //     let low = 0;
        //     let high = data.length;
        //     while (low < high) {
        //         let mid = (low + high) >>> 1;
        //         if (compareShips(data[mid], ship) < 0) {
        //             low = mid + 1;
        //         } else {
        //             high = mid;
        //         }
        //     }
        //     if (low < data.length && compareShips(data[low], ship) === 0) {
        //         let ship2 = data[low];
        //         if (ship2.pop < ship.pop) {
        //             ship2.pop = ship.pop;
        //             ship2.rule = ship.rule;
        //             ship2.rle = ship.rle;
        //             improvedShips.push(speedToString(ship));
        //         } else {
        //             unchangedShips.push(speedToString(ship));
        //         }
        //     } else {
        //         data.splice(low, 0, ship);
        //         newShips.push(speedToString(ship));
        //     }
        // }
        let found: Ship[] = [];
        // for (let i = 0; i < data.length; i++) {
        //     if (i % 10000 === 0 && i > 0) {
        //         console.log(`${i}/${data.length} ships checked`);
        //     }
        //     let ship = data[i];
        for (let ship of data) {
            for (let newShip of part) {
                if (found.includes(newShip)) {
                    continue;
                }
                if (newShip.period === ship.period && newShip.dx === ship.dx && newShip.dy === ship.dy) {
                    if (newShip.pop < ship.pop) {
                        ship.pop = newShip.pop;
                        ship.rule = newShip.rule;
                        ship.rle = newShip.rle;
                        improvedShips.push(speedToString(ship));
                    } else {
                        unchangedShips.push(speedToString(ship));
                    }
                    found.push(newShip);
                    break;
                }
            }
            if (found.length === ships.length) {
                break;
            }
        }
        for (let ship of part) {
            if (!found.includes(ship)) {
                data.push(ship);
                newShips.push(speedToString(ship));
            }
        }
        data = removeDuplicateShips(data);
        await fs.writeFile(join(dataPath, type, name + '.sss'), shipsToString(data));
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
    out += `Update took ${((performance.now() - start) / 1000).toFixed(3)} seconds\n`;
    return out;
}


export async function findShip(type: string, dx: number, dy: number, period: number): Promise<Ship | null> {
    dx = Math.abs(dx);
    dy = Math.abs(dy);
    if (dx < dy) {
        let temp = dy;
        dy = dx;
        dx = temp;
    }
    let file: 'orthogonal' | 'diagonal' | 'oblique';
    if (dy === 0) {
        file = 'orthogonal';
    } else if (dx === dy) {
        file = 'diagonal';
    } else {
        file = 'oblique';
    }
    let data = parseData((await fs.readFile(join(dataPath, type, file + '.sss'))).toString());
    for (let ship of data) {
        if (ship.period === period && ship.dx === dx && ship.dy === dy) {
            return ship;
        }
    }
    return null;
}

export async function findShipRLE(type: string, dx: number, dy: number, period: number): Promise<string> {
    let data = await findShip(type, dx, dy, period);
    if (!data) {
        return `No such ship found in database!\n`;
    }
    return `#C (${dx}, ${dy})/${period}, population ${data.pop}\nx = 0, y = 0, rule = ${data.rule}\n${data.rle}\n`;
}

export async function findSpeedRLE(type: string, speed: string): Promise<string> {
    let {dx, dy, period} = parseSpeed(speed);
    return await findShipRLE(type, dx, dy, period);
}
