
import {normalize} from 'node:path';
import * as fs from 'node:fs/promises';
import {Pattern, TRANSITIONS, VALID_TRANSITIONS, unparseTransitions, arrayToTransitions, MAPPattern, MAPB0Pattern, MAPGenPattern, findType, findMinmax, createPattern, parse, parseSpeed, speedToString} from '../lifeweb/lib/index.js';
import {createAdjustable} from './adjustable/index.js';


export type Type = 'int' | 'intb0' | 'ot' | 'otb0' | 'intgen' | 'otgen' | 'intb1e' | 'intnos' | 'int1dt';

export const TYPES = ['int', 'intb0', 'ot', 'otb0', 'intgen', 'otgen', 'intb1e', 'intnos', 'int1dt'] as Type[];

export const TYPE_NAMES: {[K in Type]: string} = {
    'int': 'INT',
    'intb0': 'INT B0',
    'ot': 'OT',
    'otb0': 'OT B0',
    'intgen': 'INT Generations',
    'otgen': 'OT Generations',
    'intb1e': 'INT B1e',
    'intnos': 'INT Phoenix',
    'int1dt': 'INT 1 Death Transition',
};

export const SUPERTYPES: {[K in Type]?: Type} = {
    'ot': 'int',
    'otb0': 'intb0',
    'otgen': 'intgen',
    'intb1e': 'int',
    'intnos': 'int',
    'int1dt': 'int',
};

export const SUBTYPES: {[K in Type]?: Type[]} = {
    'int': ['ot', 'intb1e', 'intnos', 'int1dt'],
};


export interface Ship {
    pop: number;
    rule: string;
    dx: number;
    dy: number;
    period: number;
    rle: string;
    comment?: string;
    canBeInOT?: boolean;
    canBeInB1e?: boolean;
    canBeIn1DT?: boolean;
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

export function shipsToString(ships: Ship[], includeComments: boolean = true): string {
    let out = '';
    for (let ship of ships) {
        out += ship.pop + ', ' + ship.rule + ', ' + ship.dx + ', ' + ship.dy + ', ' + ship.period + ', ' + ship.rle;
        if (includeComments && ship.comment) {
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

function includesOT(min: string, max: string): boolean {
    let minP = createPattern(min) as MAPPattern | MAPB0Pattern | MAPGenPattern;
    let minTrs = minP instanceof MAPB0Pattern ? minP.evenTrs.map(x => 1 -  x) : minP.trs;
    let maxP = createPattern(max) as MAPPattern | MAPB0Pattern | MAPGenPattern;
    let maxTrs = maxP instanceof MAPB0Pattern ? maxP.evenTrs.map(x => 1 -  x) : maxP.trs;
    for (let s of [false, true]) {
        for (let number of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
            let minCount = 0;
            let maxCount = 0;
            let total = 0;
            for (let letter of VALID_TRANSITIONS[number]) {
                for (let tr of TRANSITIONS[number + letter]) {
                    if (s) {
                        tr |= (1 << 4);
                    }
                    if (minTrs[tr]) {
                        minCount++;
                    }
                    if (maxTrs[tr]) {
                        maxCount++;
                    }
                    total++;
                }
            }
            if (!(minCount === 0 || minCount === total || maxCount === 0 || maxCount === total)) {
                return false;
            }
        }
    }
    return true;
}

function has1DT(rule: string): boolean {
    let p = createPattern(rule) as MAPPattern | MAPB0Pattern | MAPGenPattern;
    let trs = p instanceof MAPB0Pattern ? p.evenTrs.map(x => 1 - x) : p.trs;
    let found = false;
    for (let value of Object.values(TRANSITIONS)) {
        let count = 0;
        for (let tr of value) {
            if (trs[tr | (1 << 4)]) {
                count++;
            }
        }
        if (count === 0) {
            if (found) {
                return false;
            }
            found = true;
        } else if (count === value.length) {
            continue;
        } else {
            return false;
        }
    }
    return true;
}

export function normalizeShips<T extends boolean | undefined = undefined>(shipType: Type, ships: Ship[], throwInvalid?: T, globalLimit?: number): T extends false ? [Ship[], string[], string[]] : Ship[] {
    let out: Ship[] = [];
    let invalidShips: string[] = [];
    let invalidPeriods: string[] = [];
    let lastUpdate = performance.now();
    for (let i = 0; i < ships.length; i++) {
        let ship = ships[i];
        let speed = speedToString(ship.dx, ship.dy, ship.period);
        let p = parse(`x = 0, y = 0, rule = ${ship.rule}\n${ship.rle}`);
        if (p.isEmpty()) {
            if (throwInvalid) {
                throw new Error(`Invalid ship detected (empty): ${shipsToString([ship]).slice(0, -1)}`);
            } else {
                console.log(`Invalid ship detected (empty): ${shipsToString([ship]).slice(0, -1)}`);
                let str = speedToString(ship.dx, ship.dy, ship.period);
                if (str.startsWith('p')) {
                    invalidPeriods.push(str);
                } else {
                    invalidShips.push(str);
                }
                continue;
            }
        }
        let limit = Math.ceil(ship.period / p.rule.period) * p.rule.period + 1;
        if (globalLimit !== undefined) {
            limit = Math.min(limit, globalLimit);
        }
        let type = findType(p, limit, true, false);
        p.run(type.stabilizedAt);
        if (!type.disp || p.population === 0) {
            if (throwInvalid) {
                throw new Error(`Invalid ship detected (empty/not periodic): ${shipsToString([ship]).slice(0, -1)}`);
            } else {
                console.log(`Invalid ship detected (empty/not periodic): ${shipsToString([ship]).slice(0, -1)}`);
                if (ship.dx === 0 && ship.dy === 0) {
                    invalidPeriods.push(speed);
                } else {
                    invalidShips.push(speed);
                }
                continue;
            }
        }
        if (ship.dx !== type.disp[0] || ship.dy !== type.disp[1] || ship.period !== type.period) {
            console.log(`Warning: Replacing ${speed} with ${speedToString(type.disp[0], type.disp[1], type.period)}`);
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
                        throw new Error(`Invalid ship detected (there is probably a bug, report this): ${shipsToString([ship]).slice(0, -1)}`);
                    } else {
                        console.log(`Invalid ship detected (there is probably a bug, report this): ${shipsToString([ship]).slice(0, -1)}`);
                        if (ship.dx === 0 && ship.dy === 0) {
                            invalidPeriods.push(speed);
                        } else {
                            invalidShips.push(speed);
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
                        throw new Error(`Invalid ship detected (there is probably a bug, report this): ${shipsToString([ship]).slice(0, -1)}`);
                    } else {
                        console.log(`Invalid ship detected (there is probably a bug, report this): ${shipsToString([ship]).slice(0, -1)}`);
                        if (ship.dx === 0 && ship.dy === 0) {
                            invalidPeriods.push(speed);
                        } else {
                            invalidShips.push(speed);
                        }
                        continue;
                    }
                }
            }
        }
        let [min, max] = findMinmax(p, limit, undefined, undefined, shipType.startsWith('ot'));
        ship.rule = min;
        ship.canBeInOT = includesOT(min, max);
        ship.canBeInB1e = p.rule.str.startsWith('B1') && !p.rule.str.startsWith('B1c');
        ship.canBeIn1DT = has1DT(max);
        if ((shipType.startsWith('ot') && !ship.canBeInOT) || (shipType === 'intb1e' && !ship.rule.startsWith('B1e')) || (shipType === 'intnos' && !ship.rule.endsWith('/S')) || (shipType === 'int1dt' && !ship.canBeIn1DT)) {
            if (throwInvalid) {
                throw new Error(`Invalid ship detected (does not match type): ${shipsToString([ship]).slice(0, -1)}`);
            } else {
                console.log(`Invalid ship detected (does not match): ${shipsToString([ship]).slice(0, -1)}`);
                if (ship.dx === 0 && ship.dy === 0) {
                    invalidPeriods.push(speed);
                } else {
                    invalidShips.push(speed);
                }
                continue;
            }
        }
        if (shipType === 'int1dt') {
            let minParts = min.split('/');
            let maxParts = max.split('/');
            if (p instanceof MAPGenPattern) {
                ship.rule = `${maxParts[0]}/${minParts[1]}/${minParts[2]}`;
            } else {
                ship.rule = `${minParts[0]}/${maxParts[1]}`;
            }
        } else if (shipType === 'intb1e') {
            if (!ship.rule.startsWith('B1')) {
                ship.rule = 'B1e' + ship.rule.slice(2);
            } else if (ship.rule.startsWith('B1c')) {
                ship.rule = 'B1' + ship.rule.slice(3);
            }
        }
        if (p instanceof MAPB0Pattern) {
            let minPop = type.phases[0].population;
            let minPhase = type.phases[0];
            let evenRule = ship.rule;
            let [bTrs, sTrs] = arrayToTransitions(p.evenTrs.reverse(), TRANSITIONS);
            let bStr = unparseTransitions(bTrs, VALID_TRANSITIONS, false);
            let sStr = unparseTransitions(sTrs, VALID_TRANSITIONS, false);
            let oddRule = `B${bStr}/S${sStr}`;
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
                ship.rule = findMinmax(p, limit, undefined, undefined)[0];
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
        if (ship.pop === 0) {
            continue;
        }
        out.push(ship);
        let now = performance.now();
        if (now - lastUpdate > 10000 && i !== ships.length - 1) {
            console.log(`${i + 1}/${ships.length} ships normalized`);
            lastUpdate = now;
        }
    }
    out = removeDuplicateShips(out);
    // @ts-ignore
    return throwInvalid === false ? [out, invalidShips, invalidPeriods] : out;
}


export function patternToShip(type: Type, p: Pattern, limit: number = 32768): Ship[] {
    let data = findType(p, limit);
    p.run(data.stabilizedAt);
    if (!data.disp) {
        throw new Error(`Pattern is not a ship or its period is greater than ${limit} generations`);
    }
    return normalizeShips(type, [{
        pop: p.population,
        rule: p.rule.str,
        dx: data.disp[0],
        dy: data.disp[1],
        period: data.period,
        rle: p.toRLE().split('\n').slice(1).join(''),
    }], true);
}


export function isValidInType(type: Type, ship: Ship): boolean {
    let p = createPattern(ship.rule);
    let out: unknown;
    if (type === 'int') {
        out = p instanceof MAPPattern && p.rule.symmetry === 'D8';
    } else if (type === 'intb0') {
        out = p instanceof MAPB0Pattern && p.rule.symmetry === 'D8';
    } else if (type === 'ot') {
        out = p instanceof MAPPattern && p.rule.symmetry === 'D8' && p.rule.str.match(/^B[1-8]*\/S[0-8]*$/);
    } else if (type === 'otb0') {
        out = p instanceof MAPB0Pattern && p.rule.symmetry === 'D8' && p.rule.str.match(/^B0[1-8]*\/S[0-7]*$/);
    } else if (type === 'intgen') {
        out = p instanceof MAPGenPattern && p.rule.symmetry === 'D8';
    } else if (type === 'otgen') {
        out = p instanceof MAPGenPattern && p.rule.symmetry === 'D8' && p.rule.str.match(/^[0-8]*\/[1-8]*\/\d+$/);
    } else if (type === 'intb1e') {
        out = p instanceof MAPPattern && p.rule.symmetry === 'D8' && p.rule.str.startsWith('B1e');
    } else if (type === 'intnos') {
        out = p instanceof MAPPattern && p.rule.symmetry === 'D8' && p.rule.str.endsWith('/S');
    } else if (type === 'int1dt') {
        return has1DT(ship.rule);
    } else {
        throw new Error(`Invalid ship type: '${type}'`);
    }
    return Boolean(out);
}

export function validateType(type: Type, ship: Ship): void {
    if (!isValidInType(type, ship)) {
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


let dataPath = normalize(`${import.meta.dirname}/../data`);

export type ChangeData = {[K in Type]?: {
    newSpeeds: [string, number][];
    improvedSpeeds: [string, number, number][];
    newPeriods: [string, number][];
    improvedPeriods: [string, number, number][];
}};

async function _addShipsToFiles(type: Type, ships: Ship[], limit: number | undefined, includeComments: boolean, _changes: ChangeData): Promise<void> {
    if (!(type in _changes)) {
        _changes[type] = {
            newSpeeds: [],
            improvedSpeeds: [],
            newPeriods: [],
            improvedPeriods: [],
        }
    }
    let changes = _changes[type] as Exclude<ChangeData[Type], undefined>;
    if (type === 'ot' || type === 'otb0') {
        ships = normalizeShips(type, ships.filter(ship => ship.canBeInOT), false, limit)[0];
    } else if (type === 'intnos') {
        ships = normalizeShips(type, ships.filter(ship => ship.rule.endsWith('/S')), false, limit)[0];
    } else if (type === 'intb1e') {
        ships = normalizeShips(type, ships.filter(ship => ship.canBeInB1e), false, limit)[0];
    } else if (type === 'int1dt') {
        ships = normalizeShips(type, ships.filter(ship => ship.canBeIn1DT), false, limit)[0];
    }
    ships = ships.filter(x => x).filter(ship => isValidInType(type, ship));
    if (ships.length === 0) {
        return;
    }
    let [oscillators, orthogonals, diagonals, obliques] = classifyShips(ships);
    for (let [part, name] of [[oscillators, 'oscillator'], [orthogonals, 'orthogonal'], [diagonals, 'diagonal'], [obliques, 'oblique']] as const) {
        if (part.length === 0) {
            continue;
        }
        if (part.length > 2048) {
            console.log('Adding ' + name + 's');
        }
        let data = parseData((await fs.readFile(`${dataPath}/${type}/${name}.sss`)).toString());
        let found: Ship[] = [];
        for (let ship of data) {
            for (let newShip of part) {
                if (found.includes(newShip)) {
                    continue;
                }
                if (newShip.period === ship.period && newShip.dx === ship.dx && newShip.dy === ship.dy) {
                    let speed = speedToString(ship.dx, ship.dy, ship.period);
                    if (newShip.pop < ship.pop) {
                        if (ship.dx === 0 && ship.dy === 0) {
                            changes.improvedPeriods.push([speed, newShip.pop, ship.pop]);
                        } else {
                            changes.improvedSpeeds.push([speed, newShip.pop, ship.pop]);
                        }
                        ship.pop = newShip.pop;
                        ship.rule = newShip.rule;
                        ship.rle = newShip.rle;
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
                let speed = speedToString(ship.dx, ship.dy, ship.period);
                if (ship.dx === 0 && ship.dy === 0) {
                    changes.newPeriods.push([speed, ship.pop]);
                } else {
                    changes.newSpeeds.push([speed, ship.pop]);
                }
            }
        }
        data = removeDuplicateShips(data);
        await fs.writeFile(`${dataPath}/${type}/${name}.sss`, shipsToString(data, includeComments));
    }
}

export async function addShipsToFiles(type: Type, ships: Ship[], limit?: number, includeComments: boolean = true, verify: boolean = true): Promise<[string, ChangeData]> {
    if (type in SUPERTYPES && SUPERTYPES[type]) {
        return addShipsToFiles(SUPERTYPES[type], ships, limit, includeComments, verify);
    }
    let start = performance.now();
    ships = ships.filter(x => x);
    // for (let ship of ships) {
    //     validateType(type, ship);
    // }
    let ships2: Ship[];
    let invalidShips: string[];
    let invalidPeriods: string[];
    if (verify) {
        [ships2, invalidShips, invalidPeriods] = normalizeShips(type, ships, false, limit);
        ships2 = ships2.filter(x => x);
    } else {
        ships2 = ships;
        invalidShips = [];
        invalidPeriods = [];
    }
    for (let ship of ships2) {
        validateType(type, ship);
    }
    let changes: ChangeData = {};
    await _addShipsToFiles(type, structuredClone(ships2), limit, includeComments, changes);
    if (type in SUBTYPES && SUBTYPES[type]) {
        for (let subtype of SUBTYPES[type]) {
            await _addShipsToFiles(subtype, structuredClone(ships2), limit, includeComments, changes);
        }
    }
    let out = '';
    if (invalidShips.length > 0) {
        out += `${invalidShips.length} invalid ship${invalidShips.length === 1 ? '' : 's'}: ${invalidShips.join(', ')}\n`;
    }
    if (invalidPeriods.length > 0) {
        out += `${invalidShips.length} invalid period${invalidPeriods.length === 1 ? '' : 's'}: ${invalidShips.join(', ')}\n`;
    }
    for (let [key, value] of Object.entries(changes)) {
        let {newSpeeds, improvedSpeeds, newPeriods, improvedPeriods} = value;
        if (newSpeeds.length === 0 && improvedSpeeds.length === 0 && newPeriods.length === 0 && improvedPeriods.length === 0) {
            out += `No changes made in ${TYPE_NAMES[key as Type]}\n`;
            continue;
        }
        out += `Changes made in ${TYPE_NAMES[key as Type]}:\n`;
        if (newSpeeds.length > 0) {
            out += `    ${newSpeeds.length} new ship${newSpeeds.length === 1 ? '' : 's'}: ${newSpeeds.map(x => x[0]).join(', ')}\n`;
        }
        if (improvedSpeeds.length > 0) {
            out += `    ${improvedSpeeds.length} improved ship${improvedSpeeds.length === 1 ? '' : 's'}: ${improvedSpeeds.map(x => x[0]).join(', ')}\n`;
        }
        if (newPeriods.length > 0) {
            out += `    ${newPeriods.length} new period${newPeriods.length === 1 ? '' : 's'}: ${newPeriods.map(x => x[0]).join(', ')}\n`;
        }
        if (improvedPeriods.length > 0) {
            out += `    ${improvedPeriods.length} improved period${improvedPeriods.length === 1 ? '' : 's'}: ${improvedPeriods.map(x => x[0]).join(', ')}\n`;
        }
    }
    out += `Update took ${((performance.now() - start) / 1000).toFixed(3)} seconds\n`;
    return [out, changes];
}

export async function mergeShips(type: Type, ships: Ship[], limit?: number): ReturnType<typeof addShipsToFiles> {
    for (let ship of ships) {
        validateType(type, ship);
    }
    let [oscillators, orthogonals, diagonals, obliques] = classifyShips(ships);
    let out: Ship[] = [];
    for (let [ships, name] of [[oscillators, 'oscillator'], [orthogonals, 'orthogonal'], [diagonals, 'diagonal'], [obliques, 'oblique']] as const) {
        ships = sortShips(ships);
        let data = parseData((await fs.readFile(`${dataPath}/${type}/${name}.sss`)).toString());
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


export async function findShip(type: Type, dx: number, dy: number, period: number, adjustables: 'yes' | 'no' | 'only' = 'yes'): Promise<[Ship, boolean] | null> {
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
            let ship: Ship = {pop, rule: p.rule.str, dx, dy, period, rle};
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
    let data = parseData((await fs.readFile(`${dataPath}/${type}/${file}.sss`)).toString());
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

export async function findShipRLE(type: Type, dx: number, dy: number, period: number, adjustables: 'yes' | 'no' | 'only' = 'yes'): Promise<string> {
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
        return `${prefix}${ship.comment ? ', ' + ship.comment : ''}\nThis ship may be downloaded at ${ship.rle}`;
    } else {
        return `#C ${prefix}${ship.comment ? ', ' + ship.comment : ''}\nx = 0, y = 0, rule = ${ship.rule}\n${ship.rle}\n`;
    }
}

export async function findSpeedRLE(type: Type, speed: string, adjustables: 'yes' | 'no' | 'only' = 'yes'): Promise<string> {
    let {dx, dy, period} = parseSpeed(speed);
    return await findShipRLE(type, dx, dy, period, adjustables);
}


export function shipIsOptimal(type: Type, ship: Ship): boolean {
    if (ship.comment && ship.comment.toLowerCase().includes('proven optimal')) {
        return true;
    } else if (ship.pop === 3 && (ship.dx !== 0 || ship.dy !== 0)) {
        return true;
    } else if (!type.includes('b0') && ship.pop === 2 && ship.dx === 0 && ship.dy === 0) {
        return true;
    } else if ((type.includes('b0') || ship.period === 1) && ship.pop === 1 && ship.dx === 0 && ship.dy === 0) {
        return true;
    } else if (type.startsWith('int') && !type.includes('b0') && ship.pop === 4 && ship.dx + ship.dy === ship.period) {
        return true;
    }
    return false;
}
