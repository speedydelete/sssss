
import {Pattern, INT, unparseTransitions, arrayToTransitions, MAPPattern, MAPB0Pattern, MAPGenPattern, identifyPeriodic, findMinmax, createPattern, parse, speedToString, HROTPattern} from '../lifeweb/lib/index.js';
import {PROVEN_OPTIMAL} from './proven_optimal.js';


export type Type = 'int' | 'intb0' | 'ot' | 'otb0' | 'intgen' | 'otgen' | 'hrotr2' | 'intb1e' | 'intnos' | 'int1dt';

export const TYPES = ['int', 'intb0', 'ot', 'otb0', 'intgen', 'otgen', 'hrotr2', 'intb1e', 'intnos', 'int1dt'];

export const TYPE_NAMES: {[K in Type]: string} = {
    'int': 'INT',
    'intb0': 'INT B0',
    'ot': 'OT',
    'otb0': 'OT B0',
    'intgen': 'INT Generations',
    'otgen': 'OT Generations',
    'hrotr2': 'HROT R2',
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

export const SUBTYPES: {[K in Type]: Type[]} = {
    'int': ['ot', 'intb1e', 'intnos', 'int1dt'],
    'intb0': ['otb0'],
    'ot': [],
    'otb0': [],
    'intgen': ['otgen'],
    'otgen': [],
    'hrotr2': [],
    'intb1e': [],
    'intnos': [],
    'int1dt': [],
};

export const OT_TYPES = ['ot', 'otb0', 'otgen'];
export const B0_TYPES = ['intb0', 'otb0'];
export const GEN_TYPES = ['intgen', 'otgen'];

export const RANGES: {[K in Type]: number} = {
    'int': 1,
    'intb0': 1,
    'ot': 1,
    'otb0': 1,
    'intgen': 1,
    'otgen': 1,
    'hrotr2': 2,
    'intb1e': 1,
    'intnos': 1,
    'int1dt': 1,
};


export interface Ship {
    pop: number;
    rule: string;
    dx: number;
    dy: number;
    period: number;
    rle: string;
    comment?: string;
    otRule?: string;
    b1eRule?: string;
    onedtRule?: string;
}

export function parseShips(data: string): Ship[] {
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
            for (let letter of INT.validTrs[number]) {
                for (let tr of INT.trs[number + letter]) {
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
    for (let value of Object.values(INT.trs)) {
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
    if (shipType in SUPERTYPES && SUPERTYPES[shipType] !== undefined) {
        shipType = SUPERTYPES[shipType] as Type;
    }
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
                if (speed.startsWith('p')) {
                    invalidPeriods.push(speed);
                } else {
                    invalidShips.push(speed);
                }
                continue;
            }
        }
        let limit = Math.ceil(ship.period / p.rule.period) * p.rule.period + 1;
        if (globalLimit !== undefined) {
            limit = Math.min(limit, globalLimit);
        }
        let type = identifyPeriodic(p, limit, true, false);
        p.run(type.stabilizedAt).shrinkToFit();
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
                type = identifyPeriodic(p, limit, false);
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
                type = identifyPeriodic(p, limit, false);
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
        let [min, max] = findMinmax(p, ship.period, type);
        ship.rule = min;
        if (SUBTYPES[shipType].some(x => OT_TYPES.includes(x)) && includesOT(min, max)) {
            ship.otRule = findMinmax(p, ship.period, type, undefined, true)[0];
        }
        if (shipType === 'int' && max.startsWith('B1') && !max.startsWith('B1c')) {
            let rule = min;
            if (!rule.startsWith('B1')) {
                rule = 'B1e' + rule.slice(1);
            } else if (rule.startsWith('B1c')) {
                rule = 'B1' + rule.slice(3);
            }
            ship.b1eRule = rule;
        }
        if (shipType === 'int' && has1DT(max)) {
            ship.onedtRule = min.split('/')[0] + '/' + max.split('/')[1];
        }
        if (p instanceof MAPB0Pattern) {
            let minPop = type.phases[0].population;
            let minPhase = type.phases[0];
            let evenRule = ship.rule;
            let [bTrs, sTrs] = arrayToTransitions(p.evenTrs.reverse(), INT);
            let bStr = unparseTransitions(bTrs, INT);
            let sStr = unparseTransitions(sTrs, INT);
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
    return (throwInvalid === false ? [out, invalidShips, invalidPeriods] : out) as T extends false ? [Ship[], string[], string[]] : Ship[];
}


export function patternToShip(type: Type, p: Pattern, limit: number = 32768): Ship {
    let data = identifyPeriodic(p, limit);
    p.run(data.stabilizedAt);
    if (!data.disp) {
        throw new Error(`Pattern is not a ship or its period is greater than ${limit} generations`);
    }
    let out = normalizeShips(type, [{
        pop: p.population,
        rule: p.rule.str,
        dx: data.disp[0],
        dy: data.disp[1],
        period: data.period,
        rle: p.toRLE().split('\n').slice(1).join(''),
    }], true)[0];
    if (OT_TYPES.includes(type) && out.otRule) {
        out.rule = out.otRule;
    }
    return out;
}


export function isValidInType(type: Type, ship: Ship): boolean {
    let p = createPattern(ship.rule);
    let out: unknown;
    if (type === 'int') {
        out = p instanceof MAPPattern && p.rule.symmetry === 'D8';
    } else if (type === 'intb0') {
        out = p instanceof MAPB0Pattern && p.rule.symmetry === 'D8';
    } else if (type === 'ot') {
        out = p instanceof MAPPattern && p.rule.symmetry === 'D8' && (p.rule.str.match(/^B[1-8]*\/S[0-8]*$/) || ship.otRule !== undefined);
    } else if (type === 'otb0') {
        out = p instanceof MAPB0Pattern && p.rule.symmetry === 'D8' && (p.rule.str.match(/^B0[1-8]*\/S[0-7]*$/) || ship.otRule !== undefined);
    } else if (type === 'intgen') {
        out = p instanceof MAPGenPattern && p.rule.symmetry === 'D8';
    } else if (type === 'otgen') {
        out = p instanceof MAPGenPattern && p.rule.symmetry === 'D8' && (p.rule.str.match(/^[0-8]*\/[1-8]*\/\d+$/) || ship.otRule !== undefined);
    } else if (type === 'hrotr2') {
        out = p instanceof HROTPattern && p.rule.states === 2 && p.rule.range === 2 && p.nh === undefined;
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


export function speedIsPossible(type: Type, dx: number, dy: number, period: number): boolean {
    for (let value of PROVEN_OPTIMAL[type]) {
        if (value[0] === dx && value[1] === dy && value[2] === period && typeof value[3] === 'boolean') {
            return value[3];
        }
    }
    if (GEN_TYPES.includes(type) && dx === 0 && dy === 0 && period === 2) {
        return false;
    } else if (B0_TYPES.includes(type) && period % 2 !== 0) {
        return false;
    } else if (dx + dy <= RANGES[type] * period) {
        return true;
    } else if (B0_TYPES.includes(type) && dx + dy <= period * 3 / 2) {
        return true;
    } else {
        return false;
    }
}

function _getOptimalPop(type: Type, dx: number, dy: number, period: number): number {
    for (let value of PROVEN_OPTIMAL[type]) {
        if (value[0] === dx && value[1] === dy && value[2] === period && typeof value[3] === 'number') {
            return value[3];
        }
    }
    if (dx === 0 && dy === 0) {
        return period === 1 || B0_TYPES.includes(type) ? 1 : 2;
    } else if (type === 'int' && dy > 0 && dx + dy === period) {
        // https://conwaylife.com/forums/viewtopic.php?p=164841#p164841
        return 4;
    } else if (type === 'int' && dy === 0 && dx + 1 === period && period >= 5) {
        // https://conwaylife.com/forums/viewtopic.php?p=165127#p165127
        return 5;
    } else {
        return 3;
    }
}

export function getOptimalPop(type: Type, dx: number, dy: number, period: number): number {
    let out = _getOptimalPop(type, dx, dy, period);
    if (type in SUPERTYPES && SUPERTYPES[type] !== undefined) {
        return Math.max(out, getOptimalPop(SUPERTYPES[type], dx, dy, period));
    } else {
        return out;
    }
}

export function shipIsOptimal(type: Type, ship: Ship): boolean {
    if (ship.comment) {
        return true;
    } else {
        return getOptimalPop(type, ship.dx, ship.dy, ship.period) === ship.pop;
    }
}
