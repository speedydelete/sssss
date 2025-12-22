
import {parse} from '../lifeweb/lib/index.js';
import {findSpeed, patternToShip, addShipsToFiles} from './index.js';


if (process.argv[2] === 'get') {
    let ship = await findSpeed(process.argv.slice(3).join(' '));
    if (!ship) {
        console.log('No such ship found in database!');
    } else {
        console.log(`#C (${ship.dx}, ${ship.dy})c/${ship.period}, population ${ship.pop}\n${ship.rle}`);
    }
} else if (process.argv[2] === 'add') {
    addShipsToFiles([patternToShip(parse(process.argv.slice(3).join(' ')))]);
} else {
    throw new Error(`Invalid subcommand: ${process.argv[2]}`);
}
