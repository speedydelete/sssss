
import {parentPort} from "node:worker_threads";
import {Rulespace, Ship, addShipsToFiles} from './index.js';


if (!parentPort) {
    throw new Error('No parent port');
}

parentPort.on('message', async ({id, space, ships, limit, includeComments}: {id: number, space: Rulespace, ships: Ship[], limit?: number, includeComments?: boolean}) => {
    if (!parentPort) {
        throw new Error('No parent port');
    }
    try {
        parentPort.postMessage({id, ok: true, data: await addShipsToFiles(space, ships, limit, includeComments)});
    } catch (error) {
        parentPort.postMessage({id, ok: false, data: (error instanceof Error && error.stack) ? error.stack : String(error)});
    }
});
