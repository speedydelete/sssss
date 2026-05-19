
import {MAPPattern, createPattern} from '../lifeweb/lib/index.js';

import {execSync} from 'node:child_process';


let base = createPattern('B3/S23') as MAPPattern;


function _findActiveRegions(p: MAPPattern, size: number, toPlace: number, out: Map<string, MAPPattern>): void {
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let q = p.copy() as MAPPattern;
            q.set(x, y, 1);
            if (toPlace > 1) {
                _findActiveRegions(q, size, toPlace - 1, out);
            } else {
                let code = q.toCanonicalApgcode();
                if (out.has(code)) {
                    continue;
                }
                out.set(code, base.loadApgcode(code).shrinkToFit());
            }
        }
    }
}

function hasLoneCells(p: MAPPattern): boolean {
    if (p.population === 1) {
        return false;
    }
    p.expand(2, 2, 2, 2);
    for (let y = 2; y < p.height - 2; y++) {
        for (let x = 2; x < p.width - 2; x++) {
            if (!p.get(x, y)) {
                continue;
            }
            let found = false;
            for (let y2 = -2; y2 <= 2; y2++) {
                for (let x2 = -2; x2 <= 2; x2++) {
                    if (y2 === 0 && x2 === 0) {
                        continue;
                    }
                    if (p.get(x + x2, y + y2)) {
                        found = true;
                        break;
                    }
                }
                if (found) {
                    break;
                }
            }
            if (!found) {
                return true;
            }
        }
    }
    return false;
}

function findActiveRegions(cells: number, includeLessThan: boolean = false): string[] {
    let p = base.copy();
    p.ensure(5, 5);
    let size = cells * 2 - 1;
    let data = new Map<string, MAPPattern>();
    _findActiveRegions(p, size, cells, data);
    let out: string[] = [];
    for (let p of data.values()) {
        if (hasLoneCells(p)) {
            continue;
        }
        if (!includeLessThan && p.population !== cells) {
            continue;
        } 
        out.push(p.shrinkToFit().toCanonicalApgcode());
    }
    return out;
}

function findLoneCellPlacements(region: string, period: number): string[] {
    let p = base.loadApgcode(region).shrinkToFit();
    let offset = period + 1;
    let minNo = offset - 2;
    let maxNoWidth = minNo + p.width;
    let maxNoHeight = minNo + p.height;
    let out = new Set<string>();
    p.expand(offset, offset, offset, offset);
    for (let y = 0; y <= p.height; y++) {
        for (let x = 0; x <= p.width; x++) {
            if (y >= minNo && y < maxNoHeight && x >= offset && x < maxNoWidth) {
                continue;
            }
            let q = p.copy();
            q.set(x, y, 1);
            out.add(q.shrinkToFit().toCanonicalApgcode());
        }
    }
    return Array.from(out);
}


let period = Number(process.argv[4]);

let regions = findActiveRegions(3, true);
let toSearch = new Set(regions);
for (let region of regions) {
    for (let code of findLoneCellPlacements(region, period)) {
        toSearch.add(code);
    }
}

console.log(Array.from(toSearch).join(' '));

let count = 0;
let start = performance.now() / 1000;
let lastUpdate = start;
for (let code of toSearch) {
    let p = base.loadApgcode(code).shrinkToFit();
    let rle = p.toRLE(false);
    execSync(`${process.argv[3]} -r 'B/S' 'B2345678/S012345678' -p '${rle}' -b 10000 10000 -g ${period} -a --5s ${process.cwd()}/out.txt -f ${process.cwd()}/out.txt`);
    if (!hasLoneCells(p)) {
        execSync(`${process.argv[3]} -r 'B1e/S' 'B1e2345678/S012345678' -p '${rle}' -b 10000 10000 -g ${period} -a --5s ${process.cwd()}/out.txt -f ${process.cwd()}/out.txt`);
    }
    count++;
    let now = performance.now() / 1000;
    if (now - lastUpdate > 10) {
        console.log(`# ${count}/${toSearch.size} (${(count / toSearch.size * 100).toFixed(3)}%) patterns checked (${(count / (now - start)).toFixed(3)} patterns/second)`);
        lastUpdate = now;
    }
}
