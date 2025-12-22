
import {MAPPattern, createPattern as _createPattern} from '../lifeweb/lib/index.js';


function createOrthogonal(dx: number, period: number): MAPPattern | null {
    return null;
}

function createDiagonal(dx: number, period: number): MAPPattern | null {
    return null;
}

function createOblique(dx: number, dy: number, period: number): MAPPattern | null {
    return null;
}

export function createAdjustable(dx: number, dy: number, period: number): MAPPattern | null {
    if (dy === 0) {
        return createOrthogonal(dx, period);
    } else if (dx === dy) {
        return createDiagonal(dx, period);
    } else {
        return createOblique(dx, dy, period);
    }
}

