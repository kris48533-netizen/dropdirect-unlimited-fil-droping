export interface TransferFile {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified?: number;
  file?: File;
}

export interface StoredFileResponse {
  id: string;
  code: string;
  name: string;
  size: number;
  type: string;
  ready: boolean;
  downloadUrl: string;
  createdAt: number;
}

export type TransferStatus =
  | "idle"
  | "uploading"
  | "upload_complete"
  | "downloading"
  | "download_complete"
  | "paused"
  | "error";

export interface TransferStats {
  bytesTransferred: number;
  totalBytes: number;
  percent: number;
  speedBytesPerSec: number;
  timeRemainingSec: number;
  currentFileIndex: number;
  totalFiles: number;
  currentFileName: string;
}

export type WebRTCSignalData =
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "candidate"; candidate: RTCIceCandidateInit }
  | { type: "ready_to_receive" }
  | { type: "transfer_complete" };
