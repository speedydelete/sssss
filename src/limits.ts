
import {parseSpeed} from '../lifeweb/lib/index.js';

import {Rulespace, SUPER_RULESPACES, RANGES, B0_RULESPACES, GENERATIONS_RULESPACES, isPartOfRulespace} from './base.js';


export const UNPARSED_PROVEN_OPTIMAL: {[K in Rulespace]: [speed: string, value: number | false][]} = {

    'int': [
        // these were proved by LLS
        // command format: ./lls -p '>0' -r 'pB1-c2345678/S012345678'
        // -s p[period] x[dx] y[dy] -b [value] [value] -p '<[pop]'
        // or: ./vls B/S B1e2345678/S012345678 periodic 'speed' [value] [value] -maxpop=[pop]
        // the bounding box threshold is 2 * period * population + 1
        // so for 2c/3o, it's 2 * 3 * (4 - 1) + 1, it's 4 - 1 because you are
        // proving that 4 is minimal, so you need to disprove that 3 is possible
        // see https://conwaylife.com/forums/viewtopic.php?p=234626#p234626 for why this works
        // threshold used: 2*3*3 + 1 = 19
        ['2c/3o', 4],
        // threshold used: 2*3*4 + 1 = 25
        ['(2, 1)c/3', 5],
        // threshold used: 2*4*3 + 1 = 25
        ['3c/4o', 4],
        ['(2, 1)c/4', 4],
        // threshold used: 2*5*4 + 1 = 41
        // search not completed yet
        ['(4, 1)c/5', 5],
    ],

    'intb0': [
        // https://conwaylife.com/forums/viewtopic.php?p=138497#p138497
        ['(2, 1)c/2', false],
    ],

    'intgen': [

    ],

    'ot': [

    ],

    'otb0': [

    ],

    'otgen': [

    ],

    'hrotr2': [

    ],

    'intb1e': [

    ],

    'intnos': [

    ],

    'int1dt': [

    ],

};

export type ProvenOptimalEntry = [dx: number, dy: number, period: number, value: number | false];

export const PROVEN_OPTIMAL = Object.fromEntries(Object.entries(UNPARSED_PROVEN_OPTIMAL).map(([space, data]) => {
    let out: ProvenOptimalEntry[] = [];
    for (let [speed, value] of data) {
        let {dx, dy, period} = parseSpeed(speed);
        out.push([dx, dy, period, value]);
    }
    return [space, out];
})) as {[K in Rulespace]: ProvenOptimalEntry[]};


export function speedIsPossible(space: Rulespace, dx: number, dy: number, period: number): boolean {
    // first check for manually proven impossible cases
    for (let value of PROVEN_OPTIMAL[space]) {
        if (value[0] === dx && value[1] === dy && value[2] === period && value[3] === false) {
            return value[3];
        }
    }
    // first the HROT case
    if (space === 'hrotr2') {
        // basic speed limit is 2c/1o and (x + y)c/(3 * x * y)
        if (dx > 2 * period || dx + dy > 3 * period) {
            return false;
        }
        return true;
    }
    // basic speed limits:
    // for non B0 it's (x + y)c/(range * (x + y))
    // for B0 it's (x + y)c/(range * (x + y) * 1.5)
    if (B0_RULESPACES.includes(space)) {
        if (dx + dy > period * 1.5) {
            return false;
        }
    } else {
        if (dx + dy > period) {
            return false;
        }
    }
    // p1 is impossible in phoenix
    if (space === 'intnos' && dx === 0 && dy === 0 && period === 1) {
        return false;
    }
    // p2 is impossible in generations rules
    if (GENERATIONS_RULESPACES.includes(space) && dx === 0 && dy === 0 && period === 2) {
        return false;
    }
    // odd periods are impossible in B0
    if (B0_RULESPACES.includes(space) && period % 2 !== 0) {
        return false;
    }
    // greater than 10c/11o and less than c/1o is impossible in INT
    // https://conwaylife.com/forums/viewtopic.php?p=235471#p235471
    // plus some additional oblique speeds
    // https://discord.com/channels/357922255553953794/1502711250616848414/1553442358572355765
    if (isPartOfRulespace(space, 'int') && dx < period && (period + dy)/(period - dx) > 11) {
        return false;
    }
    // same for B1e
    // https://discord.com/channels/357922255553953794/1502711250616848414/1553511175680036895
    if (isPartOfRulespace(space, 'intb1e') && dx < period && (period + 2*dy)/(period - dx) > 8) {
        return false;
    }
    // default is true
    return true;
}


function _getOptimalPop(space: Rulespace, dx: number, dy: number, period: number): number | false {
    if (!speedIsPossible(space, dx, dy, period)) {
        return false;
    }
    // first check for manually proven optimal cases
    for (let value of PROVEN_OPTIMAL[space]) {
        if (value[0] === dx && value[1] === dy && value[2] === period && typeof value[3] === 'number') {
            return value[3];
        }
    }
    // next handle oscillators
    if (dx === 0 && dy === 0) {
        // for still lifes 1 cell is optimal
        if (period === 1) {
            return 1;
        }
        // 1 cell is optimal in B0, otherwise 2 cells
        if (B0_RULESPACES.includes(space)) {
            return 1;
        } else {
            return 2;
        }
    }
    // now for spaceships
    // non-orthogonal lightspeed ships in INT must be minpop 4 or higher
    // https://conwaylife.com/forums/viewtopic.php?p=164841#p164841
    if (isPartOfRulespace(space, 'int') && dy > 0 && dx + dy === period) {
        return 4;
    }
    // nc/(n + 1)o is bounded at minpop 5 for period >= 5
    // https://conwaylife.com/forums/viewtopic.php?p=165127#p165127
    if (isPartOfRulespace(space, 'int') && dy === 0 && dx + 1 === period && period >= 5) {
        return 5;
    }
    // default minpop for ships is 3
    return 3;
}

export function getOptimalPop(space: Rulespace, dx: number, dy: number, period: number): number | false {
    let out = _getOptimalPop(space, dx, dy, period);
    if (out === false) {
        return false;
    }
    if (space in SUPER_RULESPACES && SUPER_RULESPACES[space] !== undefined) {
        let out2 = getOptimalPop(SUPER_RULESPACES[space], dx, dy, period);
        if (out2 === false) {
            return false;
        }
        return Math.max(out, out2);
    } else {
        return out;
    }
}
