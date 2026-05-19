
import {normalize} from 'node:path';
import * as fs from 'node:fs/promises';
import {TRANSITIONS, VALID_TRANSITIONS, parseTransitions, unparseTransitions, arrayToTransitions, MAPPattern, createPattern} from '../lifeweb/lib/index.js';
import {Type, TYPES, parseData} from './index.js';


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


if (process.argv.length < 8) {
    throw new Error(`Expected at least 5 arguments`);
}

let type = process.argv[3];
if (!(TYPES.includes(type as Type) || type === 'none')) {
    throw new Error(`Invalid type: '${type}'`)
}

let minRule = process.argv[4];
let maxRule = process.argv[5];

let [minB, minS] = parseRule(minRule);
let [maxB, maxS] = parseRule(maxRule);
let changeB = (new Set(maxB)).difference(new Set(minB));
let changeS = (new Set(maxS)).difference(new Set(minS));

let base = (createPattern(minRule) as MAPPattern).loadRLE(process.argv[6]).shrinkToFit();

let limit = parseInt(process.argv[7]);
if (Number.isNaN(limit)) {
    throw new Error(`Invalid limit: ${limit}`);
}

let extraArgs: {[key: string]: string | undefined} = {};
for (let arg of process.argv.slice(8)) {
    let [key, value] = arg.split('=');
    if (value === undefined) {
        throw new Error(`Invalid key=value argument: '${arg}'`);
    }
    extraArgs[key] = value;
}

let match: RegExpMatchArray | null;

let maxBB: [number, number] | undefined = undefined;
if (extraArgs['maxbb']) {
    if (!(match = extraArgs['maxbb'].match(/^(\d+),(\d+)$/))) {
        throw new Error(`Invalid value for maxbb (expected width,height): '${extraArgs['maxbb']}`);
    }
    maxBB = [parseInt(match[0]), parseInt(match[1])];
}

let maxPop: number | undefined = undefined;
if (extraArgs['maxpop']) {
    if (!extraArgs['maxpop'].match(/^\d+$/)) {
        throw new Error(`Invalid value for maxpop (expected natural number): '${extraArgs['maxpop']}`);
    }
    maxPop = parseInt(extraArgs['maxpop']);
}

let initialGens = 0;
if (extraArgs['initialgens']) {
    if (!extraArgs['initialgens'].match(/^\d+$/)) {
        throw new Error(`Invalid value for initialgens (expected natural number): '${extraArgs['initialgens']}`);
    }
    initialGens = parseInt(extraArgs['initialgens']);
}


let records: {[key: string]: number} = {};
if (type !== 'none') {
console.log('# Loading records');
    for (let file of ['orthogonal', 'diagonal', 'oblique', 'oscillator']) {
        let data = (await fs.readFile(normalize(`${import.meta.dirname}/../data/${type}/${file}.sss`))).toString();
        for (let ship of parseData(data)) {
            records[`${ship.dx} ${ship.dy} ${ship.period}`] = ship.pop;
        }
    }
    console.log('# Records loaded');
}


let startPhases: MAPPattern[] = [base.copy()];
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

function run(): void {
    let p = new MAPPattern(actualBase.height, actualBase.width, actualBase.data, actualBase.rule, actualBase.trs.slice());
    p.xOffset = actualBase.xOffset;
    p.yOffset = actualBase.yOffset;
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
    let phases = startPhases.slice();
    let pops = startPops.slice();
    let hashes = startHashes.slice();
    let actualFound = false;
    for (let i = initialGens; i < limit; i++) {
        p.runGeneration();
        p.shrinkToFit();
        if (maxBB !== undefined) {
            if (p.height >= maxBB[1] || p.width > maxBB[0]) {
                break;
            }
        }
        let pop = p.population;
        if (maxPop !== undefined) {
            if (pop > maxPop) {
                break;
            }   
        }
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
                        let dx2 = Math.abs(dx);
                        let dy2 = Math.abs(dy);
                        if (dy2 > dx2) {
                            let temp = dx2;
                            dx2 = dy2;
                            dy2 = temp;
                        }
                        let key = `${dy2} ${dx2} ${period}`;
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
                        console.log(`${pop}, ${unparseRule(b, s)}, ${dx}, ${dy}, ${period}, ${p.toRLE(false).replaceAll('\n', '')}`);
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
