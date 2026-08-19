import { TransferFile, TransferStats, WebRTCSignalData } from "../types";

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun.services.mozilla.com" },
];

export const CHUNK_SIZE = 64 * 1024; // 64 KB chunks for optimal WebRTC throughput
const MAX_BUFFERED_AMOUNT = 4 * 1024 * 1024; // 4 MB backpressure threshold

export interface WebRTCClientOptions {
  onSignal: (signal: WebRTCSignalData, targetPeerId?: string) => void;
  onStatusChange: (status: string) => void;
  onProgress: (stats: TransferStats) => void;
  onFileReceived: (file: { name: string; size: number; type: string; blob?: Blob }) => void;
  onError: (err: string) => void;
}

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private options: WebRTCClientOptions;
  private isSender: boolean;
  private isTransferring = false;
  private isPaused = false;
  private cancelRequested = false;

  // Receiving state
  private currentIncomingFile: {
    name: string;
    size: number;
    type: string;
    totalBytes: number;
    receivedBytes: number;
    chunks: ArrayBuffer[];
  } | null = null;

  // Stats calculation
  private bytesTransferred = 0;
  private totalBytes = 0;
  private startTime = 0;
  private lastTime = 0;
  private lastBytes = 0;
  private currentSpeed = 0;
  private speedSamples: number[] = [];

  constructor(isSender: boolean, options: WebRTCClientOptions) {
    this.isSender = isSender;
    this.options = options;
  }

  public async initConnection(): Promise<void> {
    this.cleanup();

    this.pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.options.onSignal({
          type: "candidate",
          candidate: event.candidate.toJSON(),
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      const state = this.pc.connectionState;
      if (state === "connected") {
        this.options.onStatusChange("connected");
      } else if (state === "disconnected" || state === "failed" || state === "closed") {
        this.options.onStatusChange("disconnected");
      }
    };

    if (this.isSender) {
      // Create DataChannel on sender side
      this.dc = this.pc.createDataChannel("fileTransfer", {
        ordered: true,
      });
      this.setupDataChannel(this.dc);

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.options.onSignal({
        type: "offer",
        sdp: offer,
      });
    } else {
      // Receiver listens for data channel
      this.pc.ondatachannel = (event) => {
        this.dc = event.channel;
        this.setupDataChannel(this.dc);
      };
    }
  }

  public async handleSignal(signal: WebRTCSignalData): Promise<void> {
    if (!this.pc) {
      await this.initConnection();
    }

    if (!this.pc) return;

    try {
      if (signal.type === "offer") {
        await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.options.onSignal({
          type: "answer",
          sdp: answer,
        });
      } else if (signal.type === "answer") {
        await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === "candidate") {
        await this.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (err) {
      console.error("Signal handling error:", err);
      this.options.onError("Błąd nawiązywania bezpiecznego połączenia P2P");
    }
  }

  private setupDataChannel(dc: RTCDataChannel) {
    dc.binaryType = "arraybuffer";
    dc.bufferedAmountLowThreshold = 1024 * 1024; // 1MB threshold

    dc.onopen = () => {
      this.options.onStatusChange("connected");
    };

    dc.onclose = () => {
      this.options.onStatusChange("disconnected");
    };

    dc.onerror = (error) => {
      console.error("DataChannel error:", error);
      this.options.onError("Błąd kanału transmisji danych");
    };

    dc.onmessage = (event) => {
      this.handleIncomingData(event.data);
    };
  }

  private handleIncomingData(data: string | ArrayBuffer) {
    if (typeof data === "string") {
      try {
        const msg = JSON.parse(data);
        if (msg.type === "file-start") {
          this.currentIncomingFile = {
            name: msg.name,
            size: msg.size,
            type: msg.mimeType || "application/octet-stream",
            totalBytes: msg.size,
            receivedBytes: 0,
            chunks: [],
          };
          this.totalBytes = msg.size;
          this.bytesTransferred = 0;
          this.startTime = performance.now();
          this.lastTime = this.startTime;
          this.lastBytes = 0;
          this.speedSamples = [];
          this.options.onStatusChange("transferring");
        } else if (msg.type === "file-end") {
          if (this.currentIncomingFile) {
            const blob = new Blob(this.currentIncomingFile.chunks, {
              type: this.currentIncomingFile.type || "application/octet-stream",
            });
            this.options.onFileReceived({
              name: this.currentIncomingFile.name,
              size: this.currentIncomingFile.size,
              type: this.currentIncomingFile.type,
              blob,
            });
            this.currentIncomingFile = null;
            this.options.onStatusChange("completed");
          }
        }
      } catch (e) {
        console.error("JSON parse error on channel:", e);
      }
    } else if (data instanceof ArrayBuffer) {
      if (this.currentIncomingFile) {
        this.currentIncomingFile.chunks.push(data);
        this.currentIncomingFile.receivedBytes += data.byteLength;
        this.bytesTransferred = this.currentIncomingFile.receivedBytes;
        this.updateProgress(this.currentIncomingFile.name, 0, 1);
      }
    }
  }

  public async sendFiles(files: TransferFile[]): Promise<void> {
    if (!this.dc || this.dc.readyState !== "open") {
      this.options.onError("Kanał przesyłania nie jest otwarty.");
      return;
    }

    this.isTransferring = true;
    this.cancelRequested = false;
    this.isPaused = false;
    this.totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    this.bytesTransferred = 0;
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.lastBytes = 0;
    this.speedSamples = [];

    this.options.onStatusChange("transferring");

    for (let i = 0; i < files.length; i++) {
      if (this.cancelRequested) break;
      const fileItem = files[i];
      if (!fileItem.file) continue;

      const rawFile = fileItem.file;

      // 1. Send Header
      this.dc.send(
        JSON.stringify({
          type: "file-start",
          id: fileItem.id,
          name: fileItem.name,
          size: fileItem.size,
          mimeType: fileItem.type,
        })
      );

      // 2. Stream chunks with backpressure
      let offset = 0;
      while (offset < rawFile.size) {
        if (this.cancelRequested) break;

        while (this.isPaused) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        // Wait if buffer is overflowing (Memory & Flow control safety)
        if (this.dc.bufferedAmount > MAX_BUFFERED_AMOUNT) {
          await new Promise<void>((resolve) => {
            const onLow = () => {
              if (this.dc) {
                this.dc.removeEventListener("bufferedamountlow", onLow);
              }
              resolve();
            };
            if (this.dc) {
              this.dc.addEventListener("bufferedamountlow", onLow);
            }
          });
        }

        const slice = rawFile.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();

        if (this.dc.readyState !== "open") {
          throw new Error("Połączenie zostało przerwane");
        }

        this.dc.send(buffer);
        offset += buffer.byteLength;
        this.bytesTransferred += buffer.byteLength;

        this.updateProgress(fileItem.name, i, files.length);
      }

      // 3. Send file-end signal
      if (!this.cancelRequested) {
        this.dc.send(
          JSON.stringify({
            type: "file-end",
            id: fileItem.id,
          })
        );
      }
    }

    if (!this.cancelRequested) {
      this.options.onStatusChange("completed");
    } else {
      this.options.onStatusChange("cancelled");
    }

    this.isTransferring = false;
  }

  private updateProgress(fileName: string, fileIndex: number, totalFiles: number) {
    const now = performance.now();
    const timeDelta = (now - this.lastTime) / 1000;

    if (timeDelta >= 0.3) {
      const bytesDelta = this.bytesTransferred - this.lastBytes;
      const instSpeed = bytesDelta / timeDelta;
      this.speedSamples.push(instSpeed);
      if (this.speedSamples.length > 5) this.speedSamples.shift();

      this.currentSpeed = this.speedSamples.reduce((a, b) => a + b, 0) / this.speedSamples.length;
      this.lastTime = now;
      this.lastBytes = this.bytesTransferred;
    }

    const remainingBytes = Math.max(0, this.totalBytes - this.bytesTransferred);
    const etaSec = this.currentSpeed > 0 ? remainingBytes / this.currentSpeed : 0;
    const percent = this.totalBytes > 0 ? Math.min(100, (this.bytesTransferred / this.totalBytes) * 100) : 0;

    this.options.onProgress({
      bytesTransferred: this.bytesTransferred,
      totalBytes: this.totalBytes,
      percent,
      speedBytesPerSec: this.currentSpeed,
      timeRemainingSec: etaSec,
      currentFileIndex: fileIndex,
      totalFiles,
      currentFileName: fileName,
    });
  }

  public pause(): void {
    this.isPaused = true;
    this.options.onStatusChange("paused");
  }

  public resume(): void {
    this.isPaused = false;
    this.options.onStatusChange("transferring");
  }

  public cancel(): void {
    this.cancelRequested = true;
    this.isTransferring = false;
    this.cleanup();
  }

  public cleanup(): void {
    if (this.dc) {
      try {
        this.dc.close();
      } catch {
        // ignore
      }
      this.dc = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        // ignore
      }
      this.pc = null;
    }
  }
}
