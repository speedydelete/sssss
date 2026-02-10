
import {Pattern, createPattern as _createPattern} from '../../lifeweb/lib/index.js';
import {INT_ADJUSTABLES} from './int.js';


export interface AdjustableGenerator {
    isValidSpeed(dx: number, dy: number, period: number): boolean;
    minPopulation(dx: number, dy: number, period: number): number | null;
    createShip(dx: number, dy: number, period: number): Pattern | null;
};

const ADJUSTABLES: {[key: string]: AdjustableGenerator[]} = {
    'int': INT_ADJUSTABLES,
};


export function createAdjustable(type: string, dx: number, dy: number, period: number): [Pattern, number] | null {
    let generators = ADJUSTABLES[type];
    if (generators === undefined) {
        return null;
    }
    let minPop = Infinity;
    let minShip: Pattern | null = null;
    for (let generator of generators) {
        if (!generator.isValidSpeed(dx, dy, period)) {
            continue;
        }
        let pop = generator.minPopulation(dx, dy, period);
        if (pop === null) {
            continue;
        }
        if (pop < minPop) {
            minPop = pop;
            minShip = generator.createShip(dx, dy, period);
        }
    }
    if (minShip) {
        return [minShip, minPop];
    }
    return null;
}
