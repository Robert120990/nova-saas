/**
 * Worker Pool Service for non-blocking report generation.
 * Distributes CPU-heavy Excel & PDF generation across Worker Threads.
 */
const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');

class ReportWorkerPool {
    constructor() {
        this.workerScriptPath = path.resolve(__dirname, '..', 'workers', 'reportWorker.js');
        // Calculate pool size: between 2 and 4 workers, reserving cores for main loop and DB
        const cpuCount = os.cpus()?.length || 4;
        this.poolSize = Math.min(4, Math.max(2, Math.floor(cpuCount / 2)));

        this.workers = []; // Array<{ worker: Worker, isBusy: boolean, currentTaskId: string|null }>
        this.queue = [];   // Array<{ task: Object, resolve: Function, reject: Function, timeoutId: NodeJS.Timeout }>
        this.taskCounter = 0;
        this.isInitialized = false;
        this.disabled = process.env.DISABLE_WORKER_THREADS === 'true';

        if (!this.disabled) {
            this.initPool();
        }
    }

    /**
     * Initializes worker threads up to poolSize
     */
    initPool() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        for (let i = 0; i < this.poolSize; i++) {
            this.spawnWorker(i);
        }

        process.once('beforeExit', () => this.terminateAll());
    }

    /**
     * Spawns a single worker thread and attaches lifecycle listeners
     * @param {number} index
     */
    spawnWorker(index) {
        try {
            const worker = new Worker(this.workerScriptPath);
            const workerObj = {
                id: index,
                worker,
                isBusy: false,
                currentTaskId: null,
                activeTaskCallback: null
            };

            worker.on('message', (result) => {
                if (workerObj.activeTaskCallback) {
                    const cb = workerObj.activeTaskCallback;
                    workerObj.activeTaskCallback = null;
                    workerObj.isBusy = false;
                    workerObj.currentTaskId = null;
                    cb(result);
                    this.processQueue();
                }
            });

            worker.on('error', (err) => {
                console.error(`[ReportWorkerPool] Worker ${index} error:`, err);
                if (workerObj.activeTaskCallback) {
                    const cb = workerObj.activeTaskCallback;
                    workerObj.activeTaskCallback = null;
                    workerObj.isBusy = false;
                    workerObj.currentTaskId = null;
                    cb({ success: false, error: err });
                }
            });

            worker.on('exit', (code) => {
                if (this.disabled || this.isTerminating) return;
                if (code !== 0) {
                    console.warn(`[ReportWorkerPool] Worker ${index} stopped with exit code ${code}. Respawning...`);
                }
                const currentIdx = this.workers.findIndex(w => w.id === index);
                if (currentIdx !== -1) {
                    this.workers.splice(currentIdx, 1);
                }
                this.spawnWorker(index);
            });

            this.workers.push(workerObj);
        } catch (err) {
            console.error(`[ReportWorkerPool] Failed to spawn worker ${index}:`, err);
        }
    }

    /**
     * Dispatches next queued task to an idle worker
     */
    processQueue() {
        if (this.queue.length === 0) return;

        const idleWorker = this.workers.find(w => !w.isBusy);
        if (!idleWorker) return;

        const queueItem = this.queue.shift();
        if (!queueItem) return;

        const { task, resolve, reject, timeoutId } = queueItem;

        idleWorker.isBusy = true;
        idleWorker.currentTaskId = task.taskId;
        idleWorker.activeTaskCallback = (result) => {
            clearTimeout(timeoutId);
            if (result && result.success) {
                const buf = Buffer.isBuffer(result.buffer) ? result.buffer : Buffer.from(result.buffer);
                resolve(buf);
            } else {
                reject(new Error(result?.error?.message || 'Worker task failed'));
            }
        };

        try {
            idleWorker.worker.postMessage(task);
        } catch (postError) {
            clearTimeout(timeoutId);
            idleWorker.isBusy = false;
            idleWorker.currentTaskId = null;
            idleWorker.activeTaskCallback = null;
            reject(postError);
            this.processQueue();
        }
    }

    /**
     * Executes a task in a worker thread with timeout protection
     * @param {Object} options
     * @param {'EXCEL'|'PDF_SERVICE'} options.type
     * @param {Object} options.payload
     * @param {number} [options.timeoutMs=45000]
     * @returns {Promise<Buffer>}
     */
    executeTask({ type, payload, timeoutMs = 45000 }) {
        if (this.disabled || this.isTerminating || this.workers.length === 0) {
            return Promise.reject(new Error('Worker pool is disabled or unavailable'));
        }

        const taskId = `task_${Date.now()}_${++this.taskCounter}`;
        const task = { taskId, type, payload };

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                // Find worker handling this task and terminate if stuck
                const busyWorkerIdx = this.workers.findIndex(w => w.currentTaskId === taskId);
                if (busyWorkerIdx !== -1) {
                    const stuckWorker = this.workers[busyWorkerIdx];
                    console.warn(`[ReportWorkerPool] Task ${taskId} timed out after ${timeoutMs}ms. Restarting worker.`);
                    stuckWorker.worker.terminate().catch(() => {});
                    this.workers.splice(busyWorkerIdx, 1);
                    this.spawnWorker(stuckWorker.id);
                }

                // Remove from queue if not started yet
                const qIdx = this.queue.findIndex(item => item.task.taskId === taskId);
                if (qIdx !== -1) {
                    this.queue.splice(qIdx, 1);
                }

                reject(new Error(`Worker execution timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            this.queue.push({ task, resolve, reject, timeoutId });
            this.processQueue();
        });
    }

    /**
     * Gracefully terminates all workers
     */
    async terminateAll() {
        this.isTerminating = true;
        const currentWorkers = [...this.workers];
        this.workers = [];
        this.queue = [];
        const terminations = currentWorkers.map(w => w.worker.terminate().catch(() => {}));
        await Promise.all(terminations);
    }
}

// Singleton pool instance
const poolInstance = new ReportWorkerPool();

/**
 * Executes an Excel generation task in the worker pool.
 * If the worker fails or is disabled, calls the fallback function.
 * @param {Object} payload - { sheets, title }
 * @param {Function} [fallbackFn] - Fallback function executing in the main thread
 * @returns {Promise<Buffer>}
 */
async function executeExcelInWorker(payload, fallbackFn) {
    try {
        return await poolInstance.executeTask({ type: 'EXCEL', payload });
    } catch (err) {
        if (typeof fallbackFn === 'function') {
            console.warn('[ReportWorkerPool] Falling back to main-thread Excel generation:', err.message);
            return await fallbackFn(payload);
        }
        throw err;
    }
}

/**
 * Executes a PDF service method in the worker pool.
 * If the worker fails or is disabled, calls the fallback function.
 * @param {Object} options - { serviceRelativePath, methodName, data }
 * @param {Function} [fallbackFn] - Fallback function executing in the main thread
 * @returns {Promise<Buffer>}
 */
async function executePdfInWorker({ serviceRelativePath, methodName, data }, fallbackFn) {
    try {
        return await poolInstance.executeTask({
            type: 'PDF_SERVICE',
            payload: { serviceRelativePath, methodName, data }
        });
    } catch (err) {
        if (typeof fallbackFn === 'function') {
            console.warn('[ReportWorkerPool] Falling back to main-thread PDF generation:', err.message);
            return await fallbackFn(data);
        }
        throw err;
    }
}

module.exports = {
    reportWorkerPool: poolInstance,
    executeExcelInWorker,
    executePdfInWorker
};
