
import {MAPPattern, createPattern} from '../lifeweb/lib/index.js';


let base = createPattern('B3/S23') as MAPPattern;
base.ensure(5, 5);


const SIZE = 5;

let patternsMap = new Map<string, MAPPattern>();

function findPatterns(p: MAPPattern, toPlace: number) {
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            let q = p.copy() as MAPPattern;
            q.set(x, y, 1);
            if (toPlace > 1) {
                findPatterns(q, toPlace - 1);
            } else {
                let code = q.toCanonicalApgcode();
                if (patternsMap.has(code)) {
                    continue;
                }
                patternsMap.set(code, q);
            }
        }
    }
}

findPatterns(base.copy(), 3);

function hasLoneCells(p: MAPPattern): boolean {
    p.expand(2, 2, 2, 2);
    for (let y = 2; y < 2 + SIZE; y++) {
        for (let x = 2; x < 2 + SIZE; x++) {
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

let patterns = Array.from(patternsMap.values()).filter(x => !hasLoneCells(x)).map(x => x.shrinkToFit());

console.log(patterns.map(x => x.toRLE(false)).join(', '));

let scBase = base.clearedCopy();
scBase.ensure(9, 9);
for (let value = 0; value < 9; value++){
    scBase.set(value, 0, 1);
    scBase.set(value, 8, 1);
    scBase.set(0, value, 1);
    scBase.set(8, value, 1);
}

let sc = base.clearedCopy();
sc.ensure(patterns.length * 12, 9);
for (let i = 0; i < patterns.length; i++) {
    let p = scBase.copy();
    p.insert(patterns[i], 2, 2);
    sc.insert(p, i * 12, 0);
}

console.log(sc.toRLE());
