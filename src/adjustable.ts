
import {MAPPattern, createPattern as _createPattern} from '../lifeweb/lib/index.js';


function createPattern(rule: string): MAPPattern {
    return _createPattern(rule) as MAPPattern;
}

export const ADJUSTABLE_SHIPS: ((dx: number, dy: number, period: number) => undefined | MAPPattern)[] = [


    

    function(dx: number, dy: number, period: number): undefined | MAPPattern {
        return undefined;
    },

    function(dx: number, dy: number, period: number): undefined | MAPPattern {
        return undefined;
    },

];
