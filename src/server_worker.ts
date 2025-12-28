
import {parentPort} from "node:worker_threads";
import {Ship, addShipsToFiles} from './index.js';


if (!parentPort) {
    throw new Error('No parent port');
}

parentPort.on('message', async ({id, type, ships, limit}: {id: number, type: string, ships: Ship[], limit?: number}) => {
    if (!parentPort) {
        throw new Error('No parent port');
    }
    try {
        parentPort.postMessage({id, ok: true, data: await addShipsToFiles(type, ships, limit)});
    } catch (error) {
        parentPort.postMessage({id, ok: false, data: (error instanceof Error && error.stack) ? error.stack : String(error)});
    }
});
