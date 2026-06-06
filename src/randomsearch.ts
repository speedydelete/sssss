
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import {INT, unparseTransitions, arrayToTransitions, MAPPattern, MAPB0Pattern, MAPGenPattern, findMinmax, createPattern} from '../lifeweb/lib/index.js';
import {Type, TYPES, parseShips} from './index.js';


type Pattern = MAPPattern | MAPB0Pattern | MAPGenPattern;

type Symmetry = 'C1' | 'C2_1' | 'C2_2eo' | 'C2_2oe' | 'C2_4' | 'C4_1' | 'C4_4' | 'D2_|1' | 'D2_|2' | 'D2_-1' | 'D2_-2' | 'D2_\\' | 'D2_/' | 'D4_+1' | 'D4_+2eo' | 'D4_+2oe' | 'D4_+4' | 'D4_x1' | 'D4_x4' | 'D8_1' | 'D8_4';

const SYMMETRIES = ['C1', 'C2_1', 'C2_eo', 'C2_oe', 'C2_4', 'C4_1', 'C4_4', 'D2_|1', 'D2_|2', 'D2_-1', 'D2_-2', 'D2_\\', 'D2_/', 'D4_+1', 'D4_+2eo', 'D4_+2oe', 'D4_+4', 'D4_x1', 'D4_x4', 'D8_1', 'D8_4'];


function parseRule(rule: string): [string[], string[], number] {
    let p = createPattern(rule);
    let b: string[];
    let s: string[];
    if (p instanceof MAPPattern) {
        [b, s] = arrayToTransitions(p.trs, INT);
    } else if (p instanceof MAPB0Pattern) {
        [b, s] = arrayToTransitions(p.evenTrs.map(x => 1 - x), INT);
    } else if (p instanceof MAPGenPattern) {
        [b, s] = arrayToTransitions(p.trs, INT);
    } else {
        throw new Error(`Rule is not in INT, INT B0, or INT Generations: '${rule}'`);
    }
    return [b, s, p.rule.states];
}

function unparseRule(p: Pattern): string {
    let bTrs: string[];
    let sTrs: string[];
    if (p instanceof MAPB0Pattern) {
        [bTrs, sTrs] = arrayToTransitions(p.evenTrs.map(x => 1 - x), INT);
    } else {
        [bTrs, sTrs] = arrayToTransitions(p.trs, INT);
    }
    let b = unparseTransitions(bTrs, INT);
    let s = unparseTransitions(sTrs, INT);
    if (p.rule.states === 2) {
        return `B${b}/S${s}`;
    } else {
        return `${s}/${b}/${p.rule.states}`;
    }
}


if (process.argv.length < 8) {
    throw new Error(`Expected at least 5 arguments`);
}

let type = process.argv[3];
if (!(TYPES.includes(type as Type) || type === 'none' || type === 'report-all')) {
    throw new Error(`Invalid type: '${type}'`);
}

let minRule = process.argv[4];
let maxRule = process.argv[5];
let [minB, minS, minStates] = parseRule(minRule);
let [maxB, maxS, maxStates] = parseRule(maxRule);
let changeB = (new Set(maxB)).difference(new Set(minB));
let changeS = (new Set(maxS)).difference(new Set(minS));

let base = (createPattern(minRule) as Pattern).loadRLE(process.argv[6]).shrinkToFit();
base.xOffset = 0;
base.yOffset = 0;

let limit = parseInt(process.argv[7]);
if (Number.isNaN(limit)) {
    throw new Error(`Invalid limit: ${limit}`);
}

let extraArgs: {[key: string]: string | undefined} = {};
for (let arg of process.argv.slice(8)) {
    let [key, value] = arg.split('=');
    extraArgs[key] = value ?? true;
}

let match: RegExpMatchArray | null;

function getNumber(key: string): number | undefined {
    let value = extraArgs[key];
    if (value !== undefined) {
        if (!value.match(/^\d+$/)) {
            throw new Error(`Invalid value for ${key} (expected natural number): '${value}`);
        }
        return parseInt(value);
    }
}

let initialGens = getNumber('initialgens') ?? 0;

let maxBB: [number, number] | undefined = undefined;
if (extraArgs['max-bb']) {
    if (!(match = extraArgs['max-bb'].match(/^(\d+)x(\d+)$/))) {
        throw new Error(`Invalid value for maxbb (expected width,height): '${extraArgs['max-bb']}`);
    }
    maxBB = [parseInt(match[0]), parseInt(match[1])];
}

let maxPop = getNumber('max-pop');

let noBBChange = Boolean(extraArgs['no-bb-change']);

let checkLinear = getNumber('check-linear');

let noForceShips = Boolean(extraArgs['no-force-ships']);

let noOscs = Boolean(extraArgs['no-oscs']);
let minPeriod = getNumber('min-period');
let minOscPeriod = getNumber('min-osc-period');

let noEvolve = Boolean(extraArgs['no-evolve']);

let autoSubmit = getNumber('autosubmit');
let toSubmit: string[] = [];
let currentlySubmitting = false;
let lastSubmitTime = performance.now() / 1000;


let records: {[key: string]: number} = {};
if (type !== 'none' && type !== 'report-all') {
    console.log('# Loading records');
    for (let file of ['orthogonal', 'diagonal', 'oblique', 'oscillator']) {
        let data = (await fs.readFile(path.join(import.meta.dirname, '..', 'data', type, file + '.sss'))).toString();
        for (let ship of parseShips(data)) {
            records[`${ship.dx} ${ship.dy} ${ship.period}`] = ship.pop;
        }
    }
    console.log('# Records loaded');
}


// check for D2_| symmetry
function checkForSymmetryD2v(p: Pattern): boolean {
    let widthd2 = Math.floor(p.width / 2);
    let i = 0;
    let j = p.width - 1;
    for (let y = 0; y < p.height; y++) {
        for (let x = 0; x < widthd2; x++) {
            if (p.data[i] !== p.data[j]) {
                return false;
            }
            i++;
            j--;
        }
        j += p.width * 2;
    }
    return true;
}

// check for D2_/ symmetry
function checkForSymmetryD2s(p: Pattern): boolean {
    if (p.height !== p.width) {
        return false;
    }
    for (let y = 0; y < p.height; y++) {
        let i = y * p.width;
        let j = p.size - y - 1;
        for (let x = 0; x < p.height - y; x++) {
            if (p.data[i] !== p.data[j]) {
                return false;
            }
            i++;
            j--;
        }
    }
    return true;
}

// check for D2_\ symemtry
function checkForSymmetryD2b(p: Pattern): boolean {
    if (p.height !== p.width) {
        return false;
    }
    for (let y = 0; y < p.height; y++) {
        let i = y * p.width + y + 1;
        let j = i - 1 + p.width;
        for (let x = y + 1; x < p.width; x++) {
            if (p.data[i++] !== p.data[j]) {
                return false;
            }
            j += p.height;
        }
    }
    return true;
}

// // check for C4 symmetry when C2 symmetry is known
// function checkForSymmetryC4HasC2(p: Pattern): boolean {
//     if (p.width !== p.height) {
//         return false;
//     }
//     // because C2 is known we only need to check the first quadrant rotated left and right
//     let max = Math.ceil(p.height / 2);
//     for (let y = 0; y < max; y++) {
//         let i = y * p.width;
//         let j1 = p.width - y - 1;
//         let j2 = (max - );
//         for (let x = 0; x < max; x++) {

//         }
//     }
// }

// function checkForSymmetryGrowthC1(p: Pattern): Symmetry {
//     let height = p.height;
//     let width = p.width;
//     let data = p.data;
//     // test for D2_- and C2 symmetry at the same time
//     let heightd2 = Math.floor(height / 2);
//     let D2h = true;
//     let C2 = false;
//     let C2j = p.size - 1;
//     let i = 0;
//     for (let y = 0; y < heightd2; y++) {
//         let D2hj = p.size - width - i;
//         for (let x = 0; x < width; x++) {
//             if (data[i] !== data[D2hj]) {
//                 D2h = false;
//                 if (!C2) {
//                     break;
//                 }
//             }
//             if (data[i] !== data[C2j]) {
//                 C2 = false;
//                 if (!D2h) {
//                     break;
//                 }
//             }
//             i++;
//             D2hj++;
//             C2j--;
//         }
//         if (!D2h && !C2) {
//             break;
//         }
//     }
//     // test for D2_\ symmetry
//     let D2b = checkForSymmetryD2b(p);
//     // after this check it can no longer have D8 symmetry
//     if (D2h && D2b) {
//         return `D8_${height % 2 === 1 ? '1' : '4'}`;
//     }
//     // after these checks it can no longer have D2_- symmetry
//     if (D2h) {
//         if (C2) {
//             // after this check it can no longer have D4_+ symmetry
//             if (height % 2 === 1) {
//                 if (width % 2 === 1) {
//                     return 'D4_+1';
//                 } else {
//                     return 'D4_+2oe';
//                 }
//             } else {
//                 if (width % 2 === 1) {
//                     return 'D4_+2eo';
//                 } else {
//                     return 'D4_+4';
//                 }
//             }
//         } else {
//             // the only enhancements of D2_- symmetry are D4_+ and D8, none of which are true
//             return `D2_-${height % 2 === 1 ? '1' : '2'}`;
//         }
//     }
//     // after these checks it can no longer have D2_\ symmetry
//     if (D2b) {
//         if (C2) {
//             // after this check it can no longer have D4_x symmetry
//             return `D4_x${height % 2 === 1 ? '1' : '4'}`;
//         } else {
//             // the only enhancements of D2_\ symmetry are D4_x and D8, none of which are true
//             return `D2_\\`;
//         }
//     }
//     // after these checks it can no longer have C2 symmetry
//     if (C2) {
//         // check for C4 symmetry
//         if (height === width) {
//             let C4 = true;
//             // we already know that it has C2 symmetry, so we only need 
//         }
//         if (height % 2 === 1) {
//             if (width % 2 === 1) {
//                 return 'C2_1';
//             } else {
//                 return 'C2_2oe';
//             }
//         } else {
//             if (width % 2 === 1) {
//                 return 'C2_2eo';
//             } else {
//                 return 'C2_4';
//             }
//         }
//     }
//     // it doesn't have D2_-, D2_\, or C2 symmetry, so it must either have C1, D2_/ or D2_| symmetry
//     // check for D2_| symmetry
//     if (checkForSymmetryD2v(p)) {
//         return `D2_|${width % 2 === 1 ? '1' : '2'}`;
//     }
//     // check for D2_/ symmetry
//     return checkForSymmetryD2s(p) ? 'D2_/' : 'C1';
// }

// function findSymmetryButReallyReallyFast(p: Pattern, old: Symmetry): Symmetry {
//     if (old === 'D8_1' || old === 'D8_4') {
//         return old;
//     } else if (old === 'C1') {
//         return checkForSymmetryGrowthC1(p);
//     } else if (old === 'C2_1' || old === 'C2_2eo' || old === 'C2_2oe' || old === 'C2_4') {
//         // C2 can be enhanced to C4, D4+, D4x, or D8
//         let D2v = checkForSymmetryD2v(p);
//         // after this check it can no longer have C4 or D8 symmetry
//         if (checkForSymmetryC4HasC2(p)) {
//             return `${D2v ? 'D8' : 'C4'}_${p.height % 2 === 1 ? '1' : '4'}`;
//         }
//         // after this check 
//     }
// }


let startPhases: Pattern[] = [base.copy()];
let startPops: number[] = [base.population];
let startHashes: number[] = [base.hash32()];
let actualBase = base;
if (initialGens > 0) {
    actualBase = base.copy();
    for (let i = 0; i < initialGens; i++) {
        actualBase.runGeneration();
        actualBase.shrinkToFit();
        startPhases.push(actualBase.copy());
        startPops.push(actualBase.population);
        startHashes.push(actualBase.hash32());
    }
}

let prevLines = new Set<string>();

function run(): void {
    let p = actualBase.copy();
    if (p instanceof MAPB0Pattern) {
        p.evenTrs = p.evenTrs.slice();
        p.oddTrs = p.oddTrs.slice();
        for (let tr of changeB) {
            if (Math.random() > 0.5) {
                for (let i of INT.trs[tr]) {
                    p.evenTrs[i] = 0;
                    p.oddTrs[511 - i] = 1;
                }
            }
        }
        for (let tr of changeS) {
            if (Math.random() > 0.5) {
                for (let i of INT.trs[tr]) {
                    p.evenTrs[i | (1 << 4)] = 0;
                    p.oddTrs[511 - (i | (1 << 4))] = 0;
                }
            }
        }
    } else {
        p.trs = p.trs.slice();
        for (let tr of changeB) {
            if (Math.random() > 0.5) {
                for (let i of INT.trs[tr]) {
                    p.trs[i] = 1;
                }
            }
        }
        for (let tr of changeS) {
            if (Math.random() > 0.5) {
                for (let i of INT.trs[tr]) {
                    p.trs[i | (1 << 4)] = 1;
                }
            }
        }
        if (!noForceShips && !p.trs[0b100_000_000] && !p.trs[0b010_000_000] && !p.trs[0b110_000_000] && !((p.trs[0b101_000_000] || p.trs[0b111_000_000]) && (p.trs[0b010_100_000] || p.trs[0b110_100_000]))) {
            return;
        }
        if (maxStates > 2) {
            p.rule = structuredClone(p.rule);
            p.rule.states = minStates + Math.floor(Math.random() * (maxStates - minStates));
            if (p.rule.states > 2 && !(p instanceof MAPGenPattern)) {
                p = new MAPGenPattern(p.height, p.width, p.data, p.rule, p.trs);
            }
        }
    }
    let phases = startPhases.slice();
    let pops = startPops.slice();
    let hashes = startHashes.slice();
    let startP = p.copy();
    let actualFound = false;
    for (let i = initialGens; i < limit; i++) {
        // if (i % 10000 === 0) {
        //     console.log(`${i} generations complete`);
        // }
        p.runGeneration();
        p.shrinkToFit();
        if (maxBB !== undefined) {
            if (p.height >= maxBB[1] || p.width > maxBB[0]) {
                break;
            }
        }
        if (noBBChange) {
            if (p.height !== actualBase.height || p.width !== actualBase.width) {
                break;
            }
        }
        let pop = p.population;
        if (pop === 0) {
            break;
        }
        if (maxPop !== undefined) {
            if (pop > maxPop) {
                break;
            }   
        }
        let hash = p.hash32();
        if ((i + 1) % p.rule.period === 0) {
            for (let j = 0; j <= i; j += p.rule.period) {
                if (hash === hashes[j] && pop === pops[j]) {
                    let q = phases[j];
                    let disp = p.isEqualWithTranslate(q);
                    if (disp) {
                        actualFound = true;
                        if (noEvolve && j > 0) {
                            break;
                        }
                        let [dx, dy] = disp;
                        if (noOscs && dx === 0 && dy === 0) {
                            break;
                        }
                        let period = i - j + 1;
                        if (typeof minPeriod === 'number' && period < minPeriod) {
                            break;
                        }
                        if (typeof minOscPeriod === 'number' && dx === 0 && dy === 0 && period < minOscPeriod) {
                            break;
                        }
                        let dx2 = Math.abs(dx);
                        let dy2 = Math.abs(dy);
                        if (dy2 > dx2) {
                            let temp = dx2;
                            dx2 = dy2;
                            dy2 = temp;
                        }
                        let key = `${dx2} ${dy2} ${period}`;
                        let pop = Math.min(...pops.slice(j));
                        if (key in records) {
                            if (pop < records[key]) {
                                records[key] = pop;
                            } else {
                                if (type !== 'report-all') {
                                    break;
                                }
                            }
                        } else {
                            records[key] = pop;
                        }
                        // let minmax = findMinmax(startP, i);
                        // let rulespaceSize = arrayToTransitions((createPattern(minmax[1]) as MAPPattern).trs, INT).flat().length - arrayToTransitions((createPattern(minmax[0]) as MAPPattern).trs, INT).flat().length;
                        // if (rulespaceSize < 60) {
                        //     break;
                        // }
                        let str = `${pop}, ${unparseRule(p)}, ${dx}, ${dy}, ${period}, ${q.toRLE(false).replaceAll('\n', '')}`;//, ${rulespaceSize}`;
                        if (prevLines.has(str)) {
                            break;
                        }
                        prevLines.add(str);
                        console.log(str + ', ' + unparseRule(p));
                        if (autoSubmit !== undefined) {
                            toSubmit = toSubmit.filter(x => {
                                let parts = x.split(', ');
                                if (Number(parts[2]) === dx && Number(parts[3]) === dy && Number(parts[4]) === period) {
                                    return false;
                                } else {
                                    return true;
                                }
                            });
                            toSubmit.push(str);
                            let now = performance.now() / 1000;
                            console.log(currentlySubmitting, toSubmit.length, autoSubmit, now - lastSubmitTime);
                            if (currentlySubmitting || toSubmit.length < autoSubmit || now - lastSubmitTime < 6) {
                                break;
                            }
                            lastSubmitTime = now;
                            currentlySubmitting = true;
                            fetch(`https://speedydelete.com/5s/api/add?type=${type}`, {method: 'POST', body: toSubmit.slice(0, autoSubmit).join('\n')}).then(async resp => {
                                console.log(`# Submission complete: ${resp.status} ${resp.statusText}`);
                                if (resp.ok) {
                                    for (let line of (await resp.text()).split('\n')) {
                                        console.log(`# ${line}`);
                                    }
                                }
                                currentlySubmitting = false;
                            }).catch(error => {
                                console.error(error);
                            });
                            toSubmit = toSubmit.slice(autoSubmit);
                            console.log(`# Submitting`);
                        }
                        break;
                    }
                }
                if (checkLinear !== undefined && i >= checkLinear) {
                    for (let period = 1; period < Math.floor((i - j) / 16); period++) {
                        let diff = pop - pops[pops.length - period];
                        if (diff === 0) {
                            continue;
                        }
                        let found = true;
                        for (let k = 1; k < 16; k++) {
                            if (diff !== pops[pops.length - period * k] - pops[pops.length - period * (k + 1)]) {
                                found = false;
                                break;
                            }
                        }
                        if (found) {
                            console.log(`Linear growth: ${p.population}, ${unparseRule(p)}, , , ${period}, ${p.toRLE(false).replaceAll('\n', '')}`);
                            actualFound = true;
                            break;
                        }
                    }
                }
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

let count = 0;
let start = performance.now() / 1000;
let lastUpdate = start;

while (true) {
    run();
    count++;
    let now = performance.now() / 1000;
    if (now - lastUpdate > 10) {
        console.log(`# ${count} rules checked (${(count / (now - start)).toFixed(3)} rules/second)`);
        lastUpdate = now;
    }
}
