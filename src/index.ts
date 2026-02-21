
import {join} from 'node:path';
import * as fs from 'node:fs/promises';
import {Pattern, TRANSITIONS, VALID_TRANSITIONS, unparseTransitions, arrayToTransitions, MAPPattern, MAPB0Pattern, MAPGenPattern, MAPGenB0Pattern, findType, findMinmax, createPattern, parse, parseSpeed, speedToString} from '../lifeweb/lib/index.js';
import {createAdjustable} from './adjustable/index.js';


export const TYPES = ['int', 'intb0', 'ot', 'otb0', 'intgen', 'intgenb0', 'otgen', 'otgenb0'];

export const TYPE_NAMES: {[key: string]: string} = {
    'int': 'INT',
    'intb0': 'INT B0',
    'ot': 'OT',
    'otb0': 'OT B0',
    'intgen': 'INT Generations',
    'intgenb0': 'INT Generations B0',
    'otgen': 'OT Generations',
    'otgenb0': 'OT Generations B0',
};


export interface Ship {
    pop: number;
    rule: string;
    dx: number;
    dy: number;
    period: number;
    rle: string;
    comment?: string;
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
            comment: info[6] ? info.slice(6).join(' ') : undefined,
        });
    }
    return out;
}

export function shipsToString(ships: Ship[]): string {
    let out = '';
    for (let ship of ships) {
        out += ship.pop + ', ' + ship.rule + ', ' + ship.dx + ', ' + ship.dy + ', ' + ship.period + ', ' + ship.rle;
        if (ship.comment) {
            out += ', ' + ship.comment;
        }
        out += '\n';
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

export function normalizeShips<T extends boolean | undefined = undefined>(type: string, ships: Ship[], throwInvalid?: T, globalLimit?: number): T extends false ? [Ship[], string[], string[]] : Ship[] {
    let isOT = type.startsWith('ot');
    let out: Ship[] = [];
    let invalidShips: string[] = [];
    let invalidPeriods: string[] = [];
    for (let i = 0; i < ships.length; i++) {
        let ship = ships[i];
        let p = parse(`x = 0, y = 0, rule = ${ship.rule}\n${ship.rle}`);
        if (p.isEmpty()) {
            if (throwInvalid) {
                throw new Error(`Invalid ship detected: ${shipsToString([ship]).slice(0, -1)}`);
            } else {
                console.log(`Invalid ship detected: ${shipsToString([ship]).slice(0, -1)}`);
                let str = speedToString(ship);
                if (str.startsWith('p')) {
                    invalidPeriods.push(str);
                } else {
                    invalidShips.push(str);
                }
                continue;
            }
        }
        let limit = Math.ceil(ship.period / p.rulePeriod) * p.rulePeriod + 1;
        if (globalLimit !== undefined) {
            limit = Math.min(limit, globalLimit);
        }
        let type = findType(p, limit, true, false);
        p.run(type.stabilizedAt);
        if (!type.disp || p.population === 0) {
            if (throwInvalid) {
                throw new Error(`Invalid ship detected: ${shipsToString([ship]).slice(0, -1)}`);
            } else {
                console.log(`Invalid ship detected: ${shipsToString([ship]).slice(0, -1)}`);
                if (ship.dx === 0 && ship.dy === 0) {
                    invalidPeriods.push(speedToString(ship));
                } else {
                    invalidShips.push(speedToString(ship));
                }
                continue;
            }
        }
        if (ship.dx !== type.disp[0] || ship.dy !== type.disp[1] || ship.period !== type.period) {
            console.log(`Warning: Replacing ${speedToString(ship)} with ${speedToString({dx: type.disp[0], dy: type.disp[1], period: type.period})}`);
        }
        ship.dx = type.disp[0];
        ship.dy = type.disp[1];
        ship.period = type.period;
        if (ship.dx !== 0 || ship.dy !== 0) {
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
                        if (ship.dx === 0 && ship.dy === 0) {
                            invalidPeriods.push(speedToString(ship));
                        } else {
                            invalidShips.push(speedToString(ship));
                        }
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
                        if (ship.dx === 0 && ship.dy === 0) {
                            invalidPeriods.push(speedToString(ship));
                        } else {
                            invalidShips.push(speedToString(ship));
                        }
                        continue;
                    }
                }
            }
        }
        ship.rule = findMinmax(p, limit, undefined, undefined, isOT)[0];
        if (p instanceof MAPB0Pattern || p instanceof MAPGenB0Pattern) {
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
        if (i % 100 === 0 && i > 0) {
            console.log(`${i}/${ships.length} ships normalized`);
        }
    }
    out = removeDuplicateShips(out);
    // @ts-ignore
    return throwInvalid === false ? [out, invalidShips, invalidPeriods] : out;
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


export function validateType(type: string, ship: Ship): void {
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
    } else if (type === 'otgen') {
        if (p instanceof MAPGenPattern && p.ruleStr.match(/^[0-8]*\/[1-8]*\/\d+$/)) {
            correct = true;
        }
    } else {
        throw new Error(`Invalid ship type: '${type}'`);
    }
    if (!correct) {
        throw new Error(`Invalid rule for ${TYPE_NAMES[type]}: ${ship.rule}`);
    }
}

function classifyShips(ships: Ship[]): [Ship[], Ship[], Ship[], Ship[]] {
    let oscillators: Ship[] = [];
    let orthogonals: Ship[] = [];
    let diagonals: Ship[] = [];
    let obliques: Ship[] = [];
    for (let ship of ships) {
        if (ship.dy === 0) {
            if (ship.dx === 0) {
                oscillators.push(ship);
            } else {
                orthogonals.push(ship);
            }
        } else if (ship.dx === ship.dy) {
            diagonals.push(ship);
        } else {
            obliques.push(ship);
        }
    }
    return [oscillators, orthogonals, diagonals, obliques];
}


// @ts-ignore
let dataPath = join(import.meta.dirname, '..', 'data');

export async function addShipsToFiles(type: string, ships: Ship[], limit?: number): Promise<[string, {newShips: [string, number][], improvedShips: [string, number, number][], newPeriods: [string, number][], improvedPeriods: [string, number, number][]}]> {
    let start = performance.now();
    ships = ships.filter(x => x);
    for (let ship of ships) {
        validateType(type, ship);
    }
    let [ships2, invalidShips, invalidPeriods] = normalizeShips(type, ships, false, limit);
    ships2 = ships2.filter(x => x);
    // let ships2 = ships;
    // let invalidShips: Ship[] = [];
    for (let ship of ships2) {
        validateType(type, ship);
    }
    let [oscillators, orthogonals, diagonals, obliques] = classifyShips(ships2);
    let newShips: [string, number][] = [];
    let improvedShips: [string, number, number][] = [];
    let unchangedShips: string[] = [];
    let newPeriods: [string, number][] = [];
    let improvedPeriods: [string, number, number][] = [];
    let unchangedPeriods: string[] = [];
    for (let [part, name] of [[oscillators, 'oscillator'], [orthogonals, 'orthogonal'], [diagonals, 'diagonal'], [obliques, 'oblique']] as const) {
        if (part.length === 0) {
            continue;
        }
        if (part.length > 2048) {
            console.log('Adding ' + name + 's');
        }
        let data = parseData((await fs.readFile(join(dataPath, type, name + '.sss'))).toString());
        let found: Ship[] = [];
        for (let ship of data) {
            for (let newShip of part) {
                if (found.includes(newShip)) {
                    continue;
                }
                if (newShip.period === ship.period && newShip.dx === ship.dx && newShip.dy === ship.dy) {
                    if (newShip.pop < ship.pop) {
                        if (ship.dx === 0 && ship.dy === 0) {
                            improvedPeriods.push([speedToString(ship), newShip.pop, ship.pop]);
                        } else {
                            improvedShips.push([speedToString(ship), newShip.pop, ship.pop]);
                        }
                        ship.pop = newShip.pop;
                        ship.rule = newShip.rule;
                        ship.rle = newShip.rle;
                    } else {
                        if (ship.dx === 0 && ship.dy === 0) {
                            unchangedPeriods.push(speedToString(ship));
                        } else {
                            unchangedShips.push(speedToString(ship));
                        }
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
                if (ship.dx === 0 && ship.dy === 0) {
                    newPeriods.push([speedToString(ship), ship.pop]);
                } else {
                    newShips.push([speedToString(ship), ship.pop]);
                }
            }
        }
        data = removeDuplicateShips(data);
        await fs.writeFile(join(dataPath, type, name + '.sss'), shipsToString(data));
    }
    let out = '';
    if (invalidShips.length > 0) {
        out += `${invalidShips.length} invalid ship${invalidShips.length === 1 ? '' : 's'}: ${invalidShips.join(', ')}\n`;
    }
    if (invalidPeriods.length > 0) {
        out += `${invalidShips.length} invalid period${invalidPeriods.length === 1 ? '' : 's'}: ${invalidShips.join(', ')}\n`;
    }
    if (newShips.length > 0) {
        out += `${newShips.length} new ship${newShips.length === 1 ? '' : 's'}: ${newShips.map(x => x[0]).join(', ')}\n`;
    }
    if (improvedShips.length > 0) {
        out += `${improvedShips.length} improved ship${improvedShips.length === 1 ? '' : 's'}: ${improvedShips.map(x => x[0]).join(', ')}\n`;
    }
    if (unchangedShips.length > 0) {
        out += `${unchangedShips.length} unchanged ship${unchangedShips.length === 1 ? '' : 's'}: ${unchangedShips.join(', ')}\n`;
    }
    if (newPeriods.length > 0) {
        out += `${newPeriods.length} new period${newPeriods.length === 1 ? '' : 's'}: ${newPeriods.map(x => x[0]).join(', ')}\n`;
    }
    if (improvedPeriods.length > 0) {
        out += `${improvedPeriods.length} improved period${improvedPeriods.length === 1 ? '' : 's'}: ${improvedPeriods.map(x => x[0]).join(', ')}\n`;
    }
    if (unchangedPeriods.length > 0) {
        out += `${unchangedPeriods.length} unchanged period${unchangedPeriods.length === 1 ? '' : 's'}: ${unchangedPeriods.join(', ')}\n`;
    }
    if (invalidShips.length === 0 && invalidPeriods.length === 0 && newShips.length === 0 && improvedShips.length === 0 && unchangedShips.length === 0 && newPeriods.length === 0 && improvedPeriods.length === 0 && unchangedPeriods.length === 0) {
        out = 'No changes made\n';
    }
    out += `Update took ${((performance.now() - start) / 1000).toFixed(3)} seconds\n`;
    return [out, {newShips, improvedShips, newPeriods, improvedPeriods}];
}

export async function mergeShips(type: string, ships: Ship[], limit?: number): ReturnType<typeof addShipsToFiles> {
    for (let ship of ships) {
        validateType(type, ship);
    }
    let [oscillators, orthogonals, diagonals, obliques] = classifyShips(ships);
    let out: Ship[] = [];
    for (let [ships, name] of [[oscillators, 'oscillator'], [orthogonals, 'orthogonal'], [diagonals, 'diagonal'], [obliques, 'oblique']] as const) {
        ships = sortShips(ships);
        let data = parseData((await fs.readFile(join(dataPath, type, name + '.sss'))).toString());
        let startIndex = 0;
        for (let newShip of ships) {
            let found = false;
            for (let i = startIndex; i < data.length; i++) {
                let ship = data[i];
                if (ship.period === newShip.period && ship.dx === newShip.dx && ship.dy === newShip.dy) {
                    if (newShip.pop < ship.pop) {
                        out.push(newShip);
                    }
                    found = true;
                    startIndex = i;
                    break;
                }
            }
            if (!found) {
                out.push(newShip);
            }
        }
    }
    return await addShipsToFiles(type, out, limit);
    // return [shipsToString(out), [], []];
}


export async function findShip(type: string, dx: number, dy: number, period: number, adjustables: 'yes' | 'no' | 'only' = 'yes'): Promise<[Ship, boolean] | null> {
    let adjustable: Ship | null = null;
    if (adjustables === 'yes' || adjustables === 'only') {
        let out = createAdjustable(type, dx, dy, period);
        if (out) {
            let [p, pop] = out;
            for (let i = 0; i < period; i++) {
                if (pop === p.population) {
                    break;
                }
                p.runGeneration();
            }
            if (pop !== p.population) {
                throw new Error('Adjustable generation failed!');
            }
            let rle = p.toRLE();
            rle = rle.slice(rle.indexOf('\n') + 1);
            let ship: Ship = {pop, rule: p.ruleStr, dx, dy, period, rle};
            if (adjustables === 'only') {
                return [ship, true];
            } else {
                adjustable = ship;
            }
        } else if (adjustables === 'only') {
            return null;
        }
    }
    dx = Math.abs(dx);
    dy = Math.abs(dy);
    if (dx < dy) {
        let temp = dy;
        dy = dx;
        dx = temp;
    }
    let file: 'oscillator' | 'orthogonal' | 'diagonal' | 'oblique';
    if (dy === 0) {
        if (dx === 0) {
            file = 'oscillator';
        } else {
            file = 'orthogonal';
        }
    } else if (dx === dy) {
        file = 'diagonal';
    } else {
        file = 'oblique';
    }
    let data = parseData((await fs.readFile(join(dataPath, type, file + '.sss'))).toString());
    for (let ship of data) {
        if (ship.period === period && ship.dx === dx && ship.dy === dy) {
            if (adjustable && adjustable.pop < ship.pop) {
                return [adjustable, true];
            } 
            return [ship, false];
        }
    }
    if (adjustable) {
        return [adjustable, true];
    } else {
        return null;
    }
}

export async function findShipRLE(type: string, dx: number, dy: number, period: number, adjustables: 'yes' | 'no' | 'only' = 'yes'): Promise<string> {
    let data = await findShip(type, dx, dy, period, adjustables);
    if (!data) {
        return `No such ship found in database!\n`;
    }
    let [ship, isAdjustable] = data;
    let prefix = `${dx === 0 && dy === 0 ? 'p' : `(${dx}, ${dy})c/`}${period}, population ${ship.pop}`;
    if (isAdjustable) {
        prefix += ' (adjustable)';
    }
    if (ship.rle.startsWith('http')) {
        return `${prefix}\n${ship.comment ? ship.comment + '\n' : ''}This ship may be downloaded at ${ship.rle}`;
    } else {
        return `#C ${prefix}\n${ship.comment ? `#C ${ship.comment}\n` : ''}x = 0, y = 0, rule = ${ship.rule}\n${ship.rle}\n`;
    }
}

export async function findSpeedRLE(type: string, speed: string, adjustables: 'yes' | 'no' | 'only' = 'yes'): Promise<string> {
    let {dx, dy, period} = parseSpeed(speed);
    return await findShipRLE(type, dx, dy, period, adjustables);
}
