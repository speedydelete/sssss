
import {Pattern, createPattern} from '../../lifeweb/lib/index.js';
import {AdjustableGenerator} from './index.js';


const TWO_CELL_OSCILLATOR: AdjustableGenerator & {rules: [mod: number, minN: number, minOffset: number, rule: string][]} = {

    rules: [

    ],

    minPopulation(dx: number, dy: number, period: number): number | undefined {
        if (dx !== 0 || dy !== 0) {
            return;
        }
        let mod = period % 48;
        let n = period - mod;
        for (let row of this.rules) {
            if (row[0] === mod && n >= row[1]) {
                return 2;
            }
        }
    },

    createShip(dx: number, dy: number, period: number): Pattern | undefined {
        if (dx !== 0 || dy !== 0) {
            return;
        }
        let mod = period % 48;
        let n = period - mod;
        for (let row of this.rules) {
            if (row[0] === mod && n >= row[1]) {
                let p = createPattern(row[3]);
                p.ensure(row[2] + (n - row[1]) * 4 + 1, 1);
                p.set(0, 0, 1);
                p.set(p.width - 1, 0, 1);
                return p;
            }
        }
    },

};


export const INTB0_ADJUSTABLES = [TWO_CELL_OSCILLATOR];
