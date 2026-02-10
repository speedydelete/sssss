
import {Pattern, parse} from '../../lifeweb/lib/core/index.js';
import {AdjustableGenerator} from './index.js';


const QUAD_WICKSTRETCHER = {

    isValidSpeed(dx: number, dy: number, period: number): boolean {
        return dx === 1 && dy === 0 && period >= 72 && period % 12 === 0;
    },

    minPopulation(dx: number, dy: number, period: number): number | null {
        if (this.isValidSpeed(dx, dy, period)) {
            return 3;
        }
        return null;
    },

    createShip(dx: number, dy: number, period: number): Pattern | null {
        if (this.isValidSpeed(dx, dy, period)) {
            return parse(`x = 9, y = 3, rule = B2cek3-aikr4ik5-aq6in7c8/S02ei3-acq4ckz5-acj6ik8\n${period/12 + 2}bo$o$${period/12 + 2}bo!`);
        }
        return null;
    }

} satisfies AdjustableGenerator;


export const INT_ADJUSTABLES: AdjustableGenerator[] = [QUAD_WICKSTRETCHER];
