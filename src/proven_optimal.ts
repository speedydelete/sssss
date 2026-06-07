
import {Type} from './base.js';


// see https://discord.com/channels/357922255553953794/1502711250616848414/1512870948473278524 for why the LLS commands work

export const PROVEN_OPTIMAL: {[K in Type]: [dx: number, dy: number, period: number, value: number | boolean][]} = {

    'int': [
        [2, 0, 3, 4], // ./lls -r 'pB1-c2345678/S012345678' -c -b 10 10 -s p3 x2 y0 -p '<4'
        [2, 1, 3, 4], // ./lls -r 'pB1-c2345678/S012345678' -c -b 10 10 -s p3 x2 y1 -p '<4'
        [3, 0, 4, 4], // ./lls -r 'pB1-c2345678/S012345678' -c -b 12 12 -s p4 x3 y0 -p '<4'
        [2, 1, 4, 4], // ./lls -r 'pB1-c2345678/S012345678' -c -b 12 12 -s p4 x2 y1 -p '<4'
    ],

    'intb0': [
        [2, 1, 2, false], // https://conwaylife.com/forums/viewtopic.php?p=138497#p138497
    ],

    'intgen': [

    ],

    'ot': [

    ],

    'otb0': [

    ],

    'otgen': [

    ],

    'hrotr2': [

    ],

    'intb1e': [

    ],

    'intnos': [

    ],

    'int1dt': [

    ],

};
