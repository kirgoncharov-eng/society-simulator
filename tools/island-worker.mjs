import { parentPort, workerData } from 'node:worker_threads';

const { runIsland } = await import(workerData.moduleUrl);
parentPort.on('message', i => parentPort.postMessage(runIsland(i, workerData.years)));
