
import {parentPort} from "node:worker_threads";
import {Ship, addShipsToFiles} from './index.js';


if (!parentPort) {
    throw new Error('No parent port');
}

parentPort.on('message', async ({id, type, ships, limit, includeComments}: {id: number, type: string, ships: Ship[], limit?: number, includeComments?: boolean}) => {
    if (!parentPort) {
        throw new Error('No parent port');
    }
    try {
        parentPort.postMessage({id, ok: true, data: await addShipsToFiles(type, ships, limit, includeComments)});
    } catch (error) {
        parentPort.postMessage({id, ok: false, data: (error instanceof Error && error.stack) ? error.stack : String(error)});
    }
});
