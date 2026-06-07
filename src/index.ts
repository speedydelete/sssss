
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import {parseSpeed, speedToString} from '../lifeweb/lib/index.js';
import {createAdjustable} from './adjustable/index.js';
import {Type, TYPE_NAMES, SUPERTYPES, SUBTYPES, Ship, parseShips, shipsToString, removeDuplicateShips, normalizeShips, isValidInType, validateType, shipIsOptimal} from './base.js';

export * from './base.js';



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

let dataPath = path.normalize(`${import.meta.dirname}/../data`);

export type ChangeData = {[K in Type]?: {
    newSpeeds: [string, number][];
    improvedSpeeds: [string, number, number][];
    newPeriods: [string, number][];
    improvedPeriods: [string, number, number][];
}};

async function _addShipsToFiles(type: Type, ships: Ship[], includeComments: boolean, _changes: ChangeData): Promise<void> {
    if (!(type in _changes)) {
        _changes[type] = {
            newSpeeds: [],
            improvedSpeeds: [],
            newPeriods: [],
            improvedPeriods: [],
        }
    }
    let changes = _changes[type] as Exclude<ChangeData[Type], undefined>;
    if (type === 'ot' || type === 'otb0' || type === 'otgen') {
        ships = ships.filter((x): x is Ship & {otRule: string} => x.otRule !== undefined).map(x => {
            x = structuredClone(x);
            x.rule = x.otRule;
            return x;
        });
    } else if (type === 'intnos') {
        ships = ships.filter(x => x.rule.endsWith('/S'));
    } else if (type === 'intb1e') {
        ships = ships.filter((x): x is Ship & {b1eRule: string} => x.b1eRule !== undefined).map(x => {
            x = structuredClone(x);
            x.rule = x.b1eRule;
            return x;
        });
    } else if (type === 'int1dt') {
        ships = ships.filter((x): x is Ship & {onedtRule: string} => x.onedtRule !== undefined).map(x => {
            x = structuredClone(x);
            x.rule = x.onedtRule;
            return x;
        });
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
        let filePath = path.join(dataPath, type, name + '.sss');
        let data = parseShips((await fs.readFile(filePath)).toString());
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
        await fs.writeFile(filePath, shipsToString(data, includeComments));
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
    await _addShipsToFiles(type, structuredClone(ships2), includeComments, changes);
    for (let subtype of SUBTYPES[type]) {
        await _addShipsToFiles(subtype, structuredClone(ships2), includeComments, changes);
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
    let data = parseShips((await fs.readFile(`${dataPath}/${type}/${file}.sss`)).toString());
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
    let prefix = `${speedToString(dx, dy, period)}, population ${ship.pop}`;
    if (isAdjustable) {
        prefix += ', adjustable';
    }
    if (shipIsOptimal(type, ship)) {
        prefix += ', optimal';
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
