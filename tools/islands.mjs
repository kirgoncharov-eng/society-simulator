import { availableParallelism, cpus } from 'node:os';
import { Worker } from 'node:worker_threads';

export async function runIslands(moduleUrl, runIsland, count, years, report) {
  const workers = Number(process.env.SOCIETY_WORKERS ?? (availableParallelism?.() || cpus().length));
  if (!Number.isSafeInteger(workers) || workers < 1) throw new Error('SOCIETY_WORKERS must be a positive integer');
  if (workers === 1 || count <= 1) {
    for (let i = 0; i < count; i++) report(runIsland(i, years), i);
    return;
  }

  const pool = [];
  const ready = new Map();
  let next = 0, reported = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(workers, count) }, () => new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./island-worker.mjs', import.meta.url), { workerData: { moduleUrl, years } });
      pool.push(worker);
      let i;
      const feed = () => {
        if (next >= count) { resolve(); return; }
        i = next++;
        worker.postMessage(i);
      };
      worker.on('error', reject);
      worker.on('exit', code => reject(new Error(`Island worker stopped early (exit ${code})`)));
      worker.on('message', result => {
        try {
          ready.set(i, result);
          while (ready.has(reported)) {
            const value = ready.get(reported);
            ready.delete(reported);
            report(value, reported++);
          }
          feed();
        } catch (error) { reject(error); }
      });
      feed();
    })));
  } finally {
    await Promise.all(pool.map(worker => worker.terminate()));
  }
}
