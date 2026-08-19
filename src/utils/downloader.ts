import { TransferStats } from "../types";
import { wakeLockManager } from "./wakeLock";

// Turbo Multi-threaded 4MB Chunks with 6 Parallel Pipelines
const TURBO_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunk size
const TURBO_CONCURRENCY = 6; // 6 parallel streams for up to 200 MB/s+
const MAX_CHUNK_RETRIES = 30;
const CHUNK_TIMEOUT_MS = 35000;
const MAX_PREFETCH_BUFFER = 12; // Maximum 12 chunks in memory (~48MB max) for disk backpressure

export interface DownloaderOptions {
  fileId: string;
  fileName: string;
  totalSize: number;
  onProgress: (stats: TransferStats) => void;
  onStatusChange: (status: "downloading" | "download_complete" | "paused" | "error") => void;
  onError: (errMsg: string) => void;
}

interface ChunkTask {
  index: number;
  start: number;
  end: number;
  size: number;
  attempts: number;
}

export class ResilientDownloader {
  private isPaused = false;
  private isCancelled = false;
  private options: DownloaderOptions;

  private bytesDownloaded = 0;
  private startTime = 0;
  private lastTime = 0;
  private lastBytes = 0;
  private speedSamples: number[] = [];

  private pauseResolver: (() => void) | null = null;
  private visibilityListener: (() => void) | null = null;
  private heartbeatInterval: any = null;

  constructor(options: DownloaderOptions) {
    this.options = options;
  }

  // Multi-threaded Turbo Download directly into disk file (Zero C: drive usage)
  public async startDirectStreamToDisk(fileHandle: any): Promise<void> {
    const { fileId, fileName, totalSize } = this.options;
    this.bytesDownloaded = 0;
    this.isPaused = false;
    this.isCancelled = false;
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.lastBytes = 0;
    this.speedSamples = [];

    await wakeLockManager.acquire();
    this.setupVisibilityListener();
    this.startHeartbeat();
    this.options.onStatusChange("downloading");

    const writable = await fileHandle.createWritable();

    if (totalSize === 0) {
      await writable.close();
      this.cleanup();
      this.options.onStatusChange("download_complete");
      return;
    }

    const totalChunks = Math.ceil(totalSize / TURBO_CHUNK_SIZE);

    // Queue of download tasks
    const queue: ChunkTask[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const start = i * TURBO_CHUNK_SIZE;
      const end = Math.min(totalSize - 1, start + TURBO_CHUNK_SIZE - 1);
      const size = end - start + 1;
      queue.push({ index: i, start, end, size, attempts: 0 });
    }

    // Prefetch Map: index -> Uint8Array
    const prefetchBuffer = new Map<number, Uint8Array>();
    let nextWriteIndex = 0;
    let downloadError: Error | null = null;

    // Signal when new chunk is available in prefetchBuffer
    let notifyDiskWriter: (() => void) | null = null;
    let notifyWorkers: (() => void) | null = null;

    // Parallel Download Worker
    const downloadWorker = async () => {
      while (!this.isCancelled && !downloadError && (queue.length > 0 || nextWriteIndex < totalChunks)) {
        if (this.isCancelled || downloadError) break;

        while (this.isPaused) {
          await new Promise<void>((resolve) => {
            this.pauseResolver = resolve;
          });
        }

        // Backpressure: If prefetch buffer has too many chunks ahead of writer, wait
        while (prefetchBuffer.size >= MAX_PREFETCH_BUFFER && !this.isCancelled && !downloadError) {
          await new Promise<void>((resolve) => {
            notifyWorkers = resolve;
          });
        }

        const task = queue.shift();
        if (!task) {
          if (nextWriteIndex >= totalChunks) break;
          await new Promise((r) => setTimeout(r, 60));
          continue;
        }

        try {
          const chunkData = await this.downloadSingleChunkWithRetry(fileId, task.start, task.end);
          prefetchBuffer.set(task.index, chunkData);

          this.bytesDownloaded += chunkData.byteLength;
          this.updateProgress(fileName, totalSize);

          if (notifyDiskWriter) {
            notifyDiskWriter();
            notifyDiskWriter = null;
          }
        } catch (err: any) {
          if (this.isCancelled) break;
          task.attempts++;
          if (task.attempts < MAX_CHUNK_RETRIES) {
            queue.push(task);
            await new Promise((r) =>
              setTimeout(r, Math.min(1500, 150 * Math.pow(1.25, task.attempts)))
            );
          } else {
            downloadError = new Error(
              `Błąd pobierania fragmentu ${task.index + 1}/${totalChunks}: ${err.message || "Błąd sieci"}`
            );
            if (notifyDiskWriter) notifyDiskWriter();
            break;
          }
        }
      }
    };

    // Sequential Disk Writer (writes ordered stream to disk with zero bottleneck)
    const diskWriter = async () => {
      while (nextWriteIndex < totalChunks && !this.isCancelled && !downloadError) {
        while (this.isPaused) {
          await new Promise<void>((resolve) => {
            this.pauseResolver = resolve;
          });
        }

        if (prefetchBuffer.has(nextWriteIndex)) {
          const chunk = prefetchBuffer.get(nextWriteIndex)!;
          prefetchBuffer.delete(nextWriteIndex);

          await writable.write(chunk);
          nextWriteIndex++;

          // Unblock workers waiting on backpressure
          if (notifyWorkers) {
            notifyWorkers();
            notifyWorkers = null;
          }
        } else {
          // Wait until next sequential chunk arrives
          await new Promise<void>((resolve) => {
            notifyDiskWriter = resolve;
          });
        }
      }
    };

    try {
      const activeWorkers = Math.min(TURBO_CONCURRENCY, totalChunks);
      const workerPromises = Array.from({ length: activeWorkers }, () => downloadWorker());
      const writerPromise = diskWriter();

      await Promise.all([...workerPromises, writerPromise]);

      if (downloadError) {
        throw downloadError;
      }

      if (this.isCancelled) {
        throw new Error("Pobieranie zostało anulowane");
      }

      await writable.close();

      this.options.onProgress({
        bytesTransferred: totalSize,
        totalBytes: totalSize,
        percent: 100,
        speedBytesPerSec: 0,
        timeRemainingSec: 0,
        currentFileIndex: 0,
        totalFiles: 1,
        currentFileName: fileName,
      });

      this.cleanup();
      this.options.onStatusChange("download_complete");
    } catch (err: any) {
      this.cleanup();
      try {
        await writable.abort();
      } catch {
        // ignore
      }
      throw err;
    }
  }

  // Multi-threaded Turbo Blob In-Memory Download
  public async start(): Promise<Blob> {
    const { fileId, fileName, totalSize } = this.options;
    this.bytesDownloaded = 0;
    this.isPaused = false;
    this.isCancelled = false;
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.lastBytes = 0;
    this.speedSamples = [];

    await wakeLockManager.acquire();
    this.setupVisibilityListener();
    this.startHeartbeat();
    this.options.onStatusChange("downloading");

    if (totalSize === 0) {
      this.cleanup();
      this.options.onStatusChange("download_complete");
      return new Blob([]);
    }

    const totalChunks = Math.ceil(totalSize / TURBO_CHUNK_SIZE);
    const chunkBuffers: Uint8Array[] = new Array(totalChunks);

    const queue: ChunkTask[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const start = i * TURBO_CHUNK_SIZE;
      const end = Math.min(totalSize - 1, start + TURBO_CHUNK_SIZE - 1);
      const size = end - start + 1;
      queue.push({ index: i, start, end, size, attempts: 0 });
    }

    const completed = new Set<number>();
    let downloadError: Error | null = null;

    const worker = async () => {
      while (!this.isCancelled && !downloadError && (queue.length > 0 || completed.size < totalChunks)) {
        if (this.isCancelled || downloadError) break;

        while (this.isPaused) {
          await new Promise<void>((resolve) => {
            this.pauseResolver = resolve;
          });
        }

        const task = queue.shift();
        if (!task) {
          if (completed.size >= totalChunks) break;
          await new Promise((r) => setTimeout(r, 60));
          continue;
        }

        if (completed.has(task.index)) continue;

        try {
          const chunkData = await this.downloadSingleChunkWithRetry(fileId, task.start, task.end);
          chunkBuffers[task.index] = chunkData;
          completed.add(task.index);

          this.bytesDownloaded = Array.from(completed).reduce((sum, idx) => {
            const start = idx * TURBO_CHUNK_SIZE;
            const end = Math.min(totalSize - 1, start + TURBO_CHUNK_SIZE - 1);
            return sum + (end - start + 1);
          }, 0);

          this.updateProgress(fileName, totalSize);
        } catch (err: any) {
          if (this.isCancelled) break;

          task.attempts++;
          if (task.attempts < MAX_CHUNK_RETRIES) {
            queue.push(task);
            await new Promise((r) =>
              setTimeout(r, Math.min(1500, 150 * Math.pow(1.25, task.attempts)))
            );
          } else {
            downloadError = new Error(`Błąd pobierania fragmentu ${task.index + 1}/${totalChunks}`);
            break;
          }
        }
      }
    };

    const activeWorkers = Math.min(TURBO_CONCURRENCY, totalChunks);
    const workerPromises = Array.from({ length: activeWorkers }, () => worker());
    await Promise.all(workerPromises);

    if (downloadError) {
      console.warn("Turbo chunk download failed, falling back to direct stream fetch:", downloadError);
      return await this.fallbackDirectStreamDownload();
    }

    if (this.isCancelled) {
      this.cleanup();
      throw new Error("Pobieranie zostało anulowane");
    }

    const finalBlob = new Blob(chunkBuffers);

    this.options.onProgress({
      bytesTransferred: totalSize,
      totalBytes: totalSize,
      percent: 100,
      speedBytesPerSec: 0,
      timeRemainingSec: 0,
      currentFileIndex: 0,
      totalFiles: 1,
      currentFileName: fileName,
    });

    this.cleanup();
    this.options.onStatusChange("download_complete");
    return finalBlob;
  }

  private async fallbackDirectStreamDownload(): Promise<Blob> {
    const { fileId, fileName, totalSize } = this.options;
    const res = await fetch(`/api/download/${encodeURIComponent(fileId)}`);
    if (!res.ok) {
      this.cleanup();
      throw new Error(`Błąd serwera podczas pobierania (${res.status})`);
    }

    if (!res.body) {
      const blob = await res.blob();
      this.cleanup();
      this.options.onStatusChange("download_complete");
      return blob;
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      if (this.isCancelled) {
        reader.cancel();
        this.cleanup();
        throw new Error("Pobieranie zostało anulowane");
      }

      while (this.isPaused) {
        await new Promise<void>((resolve) => {
          this.pauseResolver = resolve;
        });
      }

      const { done, value } = await reader.read();
      if (done) break;

      if (value) {
        chunks.push(value);
        receivedBytes += value.length;
        this.bytesDownloaded = receivedBytes;
        this.updateProgress(fileName, totalSize || receivedBytes);
      }
    }

    const blob = new Blob(chunks);
    this.cleanup();
    this.options.onStatusChange("download_complete");
    return blob;
  }

  private async downloadSingleChunk(
    fileId: string,
    start: number,
    end: number
  ): Promise<Uint8Array> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHUNK_TIMEOUT_MS);

    try {
      const res = await fetch(
        `/api/download/chunk?fileId=${encodeURIComponent(fileId)}&start=${start}&end=${end}`,
        {
          signal: controller.signal,
          cache: "no-store",
          headers: {
            "Accept-Encoding": "identity",
          },
        }
      );

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  private async downloadSingleChunkWithRetry(
    fileId: string,
    start: number,
    end: number
  ): Promise<Uint8Array> {
    let attempts = 0;
    while (attempts < MAX_CHUNK_RETRIES) {
      if (this.isCancelled) {
        throw new Error("Pobieranie zostało anulowane");
      }

      while (this.isPaused) {
        await new Promise<void>((resolve) => {
          this.pauseResolver = resolve;
        });
      }

      try {
        return await this.downloadSingleChunk(fileId, start, end);
      } catch (err: any) {
        attempts++;
        if (attempts >= MAX_CHUNK_RETRIES) {
          throw new Error(
            `Nie udało się pobrać fragmentu pliku (${start}-${end}) po ${MAX_CHUNK_RETRIES} próbach.`
          );
        }
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(1500, 100 * Math.pow(1.2, attempts)))
        );
      }
    }
    throw new Error("Błąd pobierania fragmentu pliku");
  }

  private setupVisibilityListener() {
    this.visibilityListener = () => {
      if (document.visibilityState === "visible" && !this.isCancelled) {
        fetch("/api/health").catch(() => {});
        if (this.pauseResolver && !this.isPaused) {
          this.pauseResolver();
          this.pauseResolver = null;
        }
      }
    };
    document.addEventListener("visibilitychange", this.visibilityListener);
    window.addEventListener("online", this.visibilityListener);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (!this.isPaused && !this.isCancelled) {
        fetch("/api/health").catch(() => {});
      }
    }, 12000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private cleanup() {
    this.stopHeartbeat();
    wakeLockManager.release();
    if (this.visibilityListener) {
      document.removeEventListener("visibilitychange", this.visibilityListener);
      window.removeEventListener("online", this.visibilityListener);
      this.visibilityListener = null;
    }
  }

  private updateProgress(fileName: string, totalSize: number) {
    const now = performance.now();
    const timeDelta = (now - this.lastTime) / 1000;

    if (timeDelta >= 0.1 || this.bytesDownloaded >= totalSize) {
      const bytesDelta = this.bytesDownloaded - this.lastBytes;
      const instSpeed = timeDelta > 0 ? bytesDelta / timeDelta : 0;
      this.speedSamples.push(instSpeed);
      if (this.speedSamples.length > 8) this.speedSamples.shift();

      const currentSpeed =
        this.speedSamples.reduce((a, b) => a + b, 0) / this.speedSamples.length;
      this.lastTime = now;
      this.lastBytes = this.bytesDownloaded;

      const remainingBytes = Math.max(0, totalSize - this.bytesDownloaded);
      const etaSec = currentSpeed > 0 ? remainingBytes / currentSpeed : 0;
      const percent = totalSize > 0 ? Math.min(100, (this.bytesDownloaded / totalSize) * 100) : 0;

      this.options.onProgress({
        bytesTransferred: this.bytesDownloaded,
        totalBytes: totalSize,
        percent,
        speedBytesPerSec: currentSpeed,
        timeRemainingSec: etaSec,
        currentFileIndex: 0,
        totalFiles: 1,
        currentFileName: fileName,
      });
    }
  }

  public pause() {
    this.isPaused = true;
    this.options.onStatusChange("paused");
  }

  public resume() {
    this.isPaused = false;
    this.options.onStatusChange("downloading");
    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = null;
    }
  }

  public cancel() {
    this.isCancelled = true;
    this.cleanup();
    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = null;
    }
  }
}
