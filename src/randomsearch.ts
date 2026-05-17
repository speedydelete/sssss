
import {TRANSITIONS, VALID_TRANSITIONS, parseTransitions, unparseTransitions, arrayToTransitions, MAPPattern, createPattern} from '../lifeweb/lib/index.js';


function parseRule(rule: string): [string[], string[]] {
    let parts = rule.split('/');
    if (parts.length !== 2) {
        throw new Error(`Rules must have exactly 1 slash`);
    }
    if (!(parts[0].startsWith('B') && parts[1].startsWith('S'))) {
        throw new Error(`Rules must be in B/S notation`);
    }
    return [
        parseTransitions(parts[0].slice(1), VALID_TRANSITIONS),
        parseTransitions(parts[1].slice(1), VALID_TRANSITIONS),
    ];
}

function unparseRule(b: string[], s: string[]): string {
    return `B${unparseTransitions(b, VALID_TRANSITIONS, false)}/S${unparseTransitions(s, VALID_TRANSITIONS, false)}`;
}


let minRule = process.argv[3];
let maxRule = process.argv[4];

let [minB, minS] = parseRule(minRule);
let [maxB, maxS] = parseRule(maxRule);
let changeB = (new Set(maxB)).difference(new Set(minB));
let changeS = (new Set(maxS)).difference(new Set(minS));

let base = (createPattern(minRule) as MAPPattern).loadRLE(process.argv[5]).shrinkToFit();

let limit = parseInt(process.argv[6]);
if (Number.isNaN(limit)) {
    throw new Error(`Invalid limit: ${limit}`);
}

let records: {[key: string]: number} = {};

while (true) {
    let p = base.copy();
    p.trs = base.trs.slice();
    for (let tr of changeB) {
        if (Math.random() > 0.5) {
            for (let i of TRANSITIONS[tr]) {
                p.trs[i] = 1;
            }
        }
    }
    for (let tr of changeS) {
        if (Math.random() > 0.5) {
            for (let i of TRANSITIONS[tr]) {
                p.trs[i | (1 << 4)] = 1;
            }
        }
    }
    let phases: MAPPattern[] = [p.copy()];
    let pops: number[] = [p.population];
    let hashes: number[] = [p.hash32()];
    let actualFound = false;
    for (let i = 0; i < limit; i++) {
        p.runGeneration();
        p.shrinkToFit();
        if (p.height !== base.height || p.width !== base.width) {
            break;
        }
        let pop = p.population;
        let hash = p.hash32();
        if (pop === 0) {
            break;
        }
        if ((i + 1) % p.rule.period === 0) {
            for (let j = 0; j <= i; j += p.rule.period) {
                if (hash === hashes[j] && pop === pops[j]) {
                    let q = phases[j];
                    let disp = p.isEqualWithTranslate(q);
                    if (disp) {
                        actualFound = true;
                        let [dx, dy] = disp;
                        let period = i - j + 1;
                        let key = `${dx} ${dy} ${period}`;
                        let pop = Math.min(...pops.slice(j));
                        if (key in records) {
                            if (pop < records[key]) {
                                records[key] = pop;
                            } else {
                                break;
                            }
                        } else {
                            records[key] = pop;
                        }
                        let [b, s] = arrayToTransitions(p.trs, TRANSITIONS);
                        console.log(`${pop}, ${unparseRule(b, s)}, ${dx}, ${dy}, ${period}, ${p.toRLE(false)}`);
                        break;
                    }
                }
                // for (let period = 1; period < Math.floor((i - j) / 16); period++) {
                //     let diff = pop - pops[pops.length - period];
                //     if (diff === 0) {
                //         continue;
                //     }
                //     let found = true;
                //     for (let k = 1; k < 16; k++) {
                //         if (diff !== pops[pops.length - period * k] - pops[pops.length - period * (k + 1)]) {
                //             found = false;
                //             break;
                //         }
                //     }
                //     if (found) {
                //         // SOMETHING GOES HERE
                //     }
                // }
            }
            if (actualFound) {
                break;
            }
        }
        phases.push(p.copy());
        pops.push(pop);
        hashes.push(hash);
    }
}
