import { TransferFile, TransferStats } from "../types";
import { wakeLockManager } from "./wakeLock";

// 2MB chunk size - optimal balance between throughput and rapid recovery
const CHUNK_SIZE = 2 * 1024 * 1024;
const CONCURRENCY = 2;
const MAX_CHUNK_RETRIES = 25;
const CHUNK_TIMEOUT_MS = 25000;

export interface UploaderOptions {
  onInit?: (info: { fileId: string; code: string; downloadUrl: string }) => void;
  onProgress: (stats: TransferStats) => void;
  onStatusChange: (status: "uploading" | "upload_complete" | "paused" | "error") => void;
  onError: (errMsg: string) => void;
}

interface ChunkTask {
  index: number;
  offset: number;
  size: number;
  attempts: number;
}

export class ChunkedUploader {
  private isPaused = false;
  private isCancelled = false;
  private options: UploaderOptions;

  private bytesUploaded = 0;
  private totalBytes = 0;
  private startTime = 0;
  private lastTime = 0;
  private lastBytes = 0;
  private speedSamples: number[] = [];
  private keepAliveTimer: any = null;

  private completedOffsets = new Set<number>();
  private pauseResolver: (() => void) | null = null;
  private visibilityListener: (() => void) | null = null;

  constructor(options: UploaderOptions) {
    this.options = options;
  }

  public async upload(
    files: TransferFile[],
    customFileHandle?: any
  ): Promise<{ fileId: string; code: string; downloadUrl: string }> {
    let mainFile: File | null = files.length > 0 && files[0].file ? files[0].file : null;

    if (customFileHandle && !mainFile) {
      mainFile = await customFileHandle.getFile();
    }

    if (!mainFile) {
      throw new Error("Brak wybranego pliku do przesłania");
    }

    this.totalBytes = mainFile.size;
    this.bytesUploaded = 0;
    this.completedOffsets.clear();
    this.isPaused = false;
    this.isCancelled = false;
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.lastBytes = 0;
    this.speedSamples = [];

    // Prevent system sleep and background tab throttling
    await wakeLockManager.acquire();

    this.options.onStatusChange("uploading");
    this.startKeepAlive();

    const totalChunks = Math.max(1, Math.ceil(mainFile.size / CHUNK_SIZE));

    // 1. Initialize session on server with auto-retry & safe JSON parser
    const initData = await this.fetchJsonWithRetry<{ fileId: string; code: string }>(
      "/api/upload/init",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: mainFile.name,
          size: mainFile.size,
          type: mainFile.type || "application/octet-stream",
          totalChunks,
        }),
      },
      MAX_CHUNK_RETRIES
    );

    const { fileId, code } = initData;

    // Immediately notify caller that code/link is ready
    if (this.options.onInit) {
      this.options.onInit({
        fileId,
        code,
        downloadUrl: `/api/download/${fileId}`,
      });
    }

    // 2. Prepare queue of chunks
    const queue: ChunkTask[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const offset = i * CHUNK_SIZE;
      const size = Math.min(CHUNK_SIZE, mainFile.size - offset);
      queue.push({ index: i, offset, size, attempts: 0 });
    }

    // Set up auto-recovery when tab becomes visible again after being away
    this.visibilityListener = () => {
      if (document.visibilityState === "visible" && !this.isCancelled) {
        this.pingServer();
        if (this.pauseResolver && !this.isPaused) {
          this.pauseResolver();
          this.pauseResolver = null;
        }
      }
    };
    document.addEventListener("visibilitychange", this.visibilityListener);
    window.addEventListener("online", this.visibilityListener);

    // 3. Worker loop processing chunk queue with dynamic resilience
    const worker = async () => {
      while (!this.isCancelled && (queue.length > 0 || this.completedOffsets.size < totalChunks)) {
        if (this.isCancelled) break;

        // If paused, wait until resumed
        while (this.isPaused) {
          await new Promise<void>((resolve) => {
            this.pauseResolver = resolve;
          });
        }

        const task = queue.shift();
        if (!task) {
          if (this.completedOffsets.size >= totalChunks) break;
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }

        if (this.completedOffsets.has(task.offset)) {
          continue;
        }

        try {
          // Direct slice from File without memory leak
          const blobSlice = mainFile!.slice(task.offset, task.offset + task.size);
          const buffer = await blobSlice.arrayBuffer();

          await this.uploadSingleChunk(fileId, task.offset, totalChunks, buffer);

          this.completedOffsets.add(task.offset);
          this.bytesUploaded = Array.from(this.completedOffsets).reduce((acc, off) => {
            return acc + Math.min(CHUNK_SIZE, mainFile!.size - off);
          }, 0);

          this.updateProgress(mainFile!.name, false);
        } catch (err: any) {
          if (this.isCancelled) break;

          task.attempts++;
          if (task.attempts < MAX_CHUNK_RETRIES) {
            queue.push(task);
            await new Promise((r) =>
              setTimeout(r, Math.min(2000, 200 * Math.pow(1.3, task.attempts)))
            );
          } else {
            throw new Error(`Błąd przesyłania fragmentu ${task.index + 1}/${totalChunks}: ${err.message || "Błąd sieci"}`);
          }
        }
      }
    };

    const activeWorkers = Math.min(CONCURRENCY, totalChunks);
    const workerPromises = Array.from({ length: activeWorkers }, () => worker());
    await Promise.all(workerPromises);

    this.updateProgress(mainFile.name, true);

    // 4. Finalize upload
    const completeData = await this.fetchJsonWithRetry<{ downloadUrl: string }>(
      `/api/upload/complete?fileId=${encodeURIComponent(fileId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      },
      MAX_CHUNK_RETRIES
    );

    this.cleanup();
    this.options.onStatusChange("upload_complete");

    return {
      fileId,
      code,
      downloadUrl: completeData.downloadUrl || `/api/download/${fileId}`,
    };
  }

  private async uploadSingleChunk(
    fileId: string,
    offset: number,
    totalChunks: number,
    buffer: ArrayBuffer
  ): Promise<void> {
    let attempts = 0;
    const maxInlineAttempts = 4;

    while (attempts < maxInlineAttempts) {
      if (this.isCancelled) throw new Error("Anulowano przesyłanie");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CHUNK_TIMEOUT_MS);

      try {
        const res = await fetch(
          `/api/upload/chunk?fileId=${encodeURIComponent(fileId)}&offset=${offset}&totalChunks=${totalChunks}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: buffer,
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!res.ok) {
          let errMsg = `HTTP ${res.status}`;
          try {
            const json = await res.json();
            if (json.error) errMsg = json.error;
          } catch {
            // ignore
          }
          throw new Error(errMsg);
        }

        return;
      } catch (err: any) {
        clearTimeout(timeoutId);
        attempts++;
        if (this.isCancelled) throw new Error("Anulowano przesyłanie");
        if (attempts >= maxInlineAttempts) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, Math.min(1500, 200 * attempts)));
      }
    }
  }

  private async fetchJsonWithRetry<T = any>(
    url: string,
    init: RequestInit,
    retries: number
  ): Promise<T> {
    let attempts = 0;
    let lastError: Error | null = null;
    while (attempts < retries) {
      if (this.isCancelled) throw new Error("Anulowano przesyłanie");
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        const res = await fetch(url, { ...init, signal: controller.signal });
        clearTimeout(timeoutId);

        const text = await res.text();

        let json: any = null;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error("Serwer przetwarza dane, ponawianie próby...");
        }

        if (!res.ok) {
          throw new Error(json?.error || `Błąd serwera (HTTP ${res.status})`);
        }

        return json as T;
      } catch (err: any) {
        attempts++;
        lastError = err;
        if (this.isCancelled) throw new Error("Anulowano przesyłanie");
        if (attempts >= retries) break;
        await new Promise((resolve) => setTimeout(resolve, Math.min(2000, 300 * attempts)));
      }
    }
    throw lastError || new Error("Brak poprawnej odpowiedzi z serwera");
  }

  private pingServer() {
    fetch("/api/health").catch(() => {});
  }

  private startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      this.pingServer();
    }, 10000);
  }

  private stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  private cleanup() {
    this.stopKeepAlive();
    wakeLockManager.release();
    if (this.visibilityListener) {
      document.removeEventListener("visibilitychange", this.visibilityListener);
      window.removeEventListener("online", this.visibilityListener);
      this.visibilityListener = null;
    }
  }

  private updateProgress(fileName: string, forceComplete: boolean = false) {
    const now = performance.now();
    const timeDelta = (now - this.lastTime) / 1000;

    if (forceComplete || timeDelta >= 0.15 || this.bytesUploaded >= this.totalBytes) {
      const bytesDelta = this.bytesUploaded - this.lastBytes;
      const instSpeed = timeDelta > 0 ? bytesDelta / timeDelta : 0;
      this.speedSamples.push(instSpeed);
      if (this.speedSamples.length > 6) this.speedSamples.shift();

      const currentSpeed =
        this.speedSamples.reduce((a, b) => a + b, 0) / this.speedSamples.length;
      this.lastTime = now;
      this.lastBytes = this.bytesUploaded;

      const remainingBytes = Math.max(0, this.totalBytes - this.bytesUploaded);
      const etaSec = currentSpeed > 0 ? remainingBytes / currentSpeed : 0;
      const percent =
        forceComplete || this.totalBytes === 0
          ? 100
          : Math.min(100, (this.bytesUploaded / this.totalBytes) * 100);

      this.options.onProgress({
        bytesTransferred: forceComplete ? this.totalBytes : this.bytesUploaded,
        totalBytes: this.totalBytes,
        percent,
        speedBytesPerSec: forceComplete ? 0 : currentSpeed,
        timeRemainingSec: forceComplete ? 0 : etaSec,
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
    this.options.onStatusChange("uploading");
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
