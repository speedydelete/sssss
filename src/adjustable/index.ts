
import {Pattern, createPattern as _createPattern} from '../../lifeweb/lib/index.js';
import {INT_ADJUSTABLES} from './int.js';
import {INTB0_ADJUSTABLES} from './intb0.js';
import {Rulespace} from '../index.js';


export interface AdjustableGenerator {
    minPopulation(dx: number, dy: number, period: number): number | undefined;
    createShip(dx: number, dy: number, period: number): Pattern | undefined;
};

const ADJUSTABLES: {[K in Rulespace]?: AdjustableGenerator[]} = {
    'int': INT_ADJUSTABLES,
    'intb0': INTB0_ADJUSTABLES,
};


export function createAdjustable(space: Rulespace, dx: number, dy: number, period: number): [Pattern, number] | undefined {
    let generators = ADJUSTABLES[space];
    if (generators === undefined) {
        return;
    }
    let minPop = Infinity;
    let minShip: Pattern | undefined = undefined;
    for (let generator of generators) {
        let pop = generator.minPopulation(dx, dy, period);
        if (pop === undefined) {
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
}
