import React, { useEffect } from "react";
import confetti from "canvas-confetti";
import {
  CheckCircle2,
  Pause,
  Play,
  XCircle,
  Activity,
  Clock,
  HardDrive,
  AlertCircle,
  UploadCloud,
  RotateCcw,
} from "lucide-react";
import { TransferStats, TransferStatus } from "../types";
import { formatBytes, formatSpeed, formatTime } from "../utils/formatters";

interface TransferProgressProps {
  stats: TransferStats;
  status: TransferStatus;
  errorMessage?: string | null;
  onPause?: () => void;
  onResume?: () => void;
  onRetry?: () => void;
  onCancel: () => void;
}

export const TransferProgress: React.FC<TransferProgressProps> = ({
  stats,
  status,
  errorMessage,
  onPause,
  onResume,
  onRetry,
  onCancel,
}) => {
  const isCompleted = status === "upload_complete";
  const isPaused = status === "paused";
  const isUploading = status === "uploading";
  const isError = status === "error";

  useEffect(() => {
    if (isCompleted) {
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }
    }
  }, [isCompleted]);

  return (
    <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Przesyłanie na serwer
          </span>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {isCompleted
              ? "Przesyłanie zakończone!"
              : isPaused
              ? "Wstrzymano przesyłanie"
              : isError
              ? "Chwilowe zakłócenie połączenia"
              : "Zapisywanie pliku na serwerze..."}
          </h2>
          {stats.currentFileName && (
            <p className="text-sm text-zinc-500 truncate max-w-md mt-0.5">
              Plik: <span className="font-medium text-zinc-800 dark:text-zinc-200">{stats.currentFileName}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isCompleted && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              100% Gotowe
            </span>
          )}
          {isPaused && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <Pause className="w-4 h-4 text-amber-600" />
              Wstrzymano
            </span>
          )}
          {isUploading && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <UploadCloud className="w-4 h-4 text-blue-600 animate-pulse" />
              Przesyłanie strumieniowe
            </span>
          )}
          {isError && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Wymaga wznowienia
            </span>
          )}
        </div>
      </div>

      {/* Error Message Box */}
      {isError && errorMessage && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Informacja o transferze</span>
          </p>
          <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
            {errorMessage}
          </p>
        </div>
      )}

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span className="text-zinc-600 dark:text-zinc-400">Postęp wysyłania</span>
          <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {stats.percent.toFixed(1)}%
          </span>
        </div>

        <div className="w-full h-4 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-200/60 dark:border-zinc-700/60">
          <div
            className={`h-full rounded-full transition-all duration-200 ${
              isCompleted
                ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                : isError
                ? "bg-amber-500"
                : "bg-gradient-to-r from-blue-600 to-indigo-600"
            }`}
            style={{ width: `${Math.max(1, stats.percent)}%` }}
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-3.5 border border-zinc-200/70 dark:border-zinc-700/70">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
            <Activity className="w-3.5 h-3.5 text-blue-500" />
            <span>Prędkość</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">
            {isCompleted ? "Gotowe" : isError ? "0 KB/s" : formatSpeed(stats.speedBytesPerSec)}
          </p>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-3.5 border border-zinc-200/70 dark:border-zinc-700/70">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
            <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
            <span>Wysłano</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">
            {formatBytes(stats.bytesTransferred)} / {formatBytes(stats.totalBytes)}
          </p>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-3.5 border border-zinc-200/70 dark:border-zinc-700/70">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            <span>Pozostały czas</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">
            {isCompleted ? "0 s" : isError ? "--" : formatTime(stats.timeRemainingSec)}
          </p>
        </div>
      </div>

      {/* Control Buttons */}
      {!isCompleted && (
        <div className="flex items-center justify-between pt-2">
          {isError && onRetry && (
            <button
              id="retry-upload-btn"
              onClick={onRetry}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Wznów przesyłanie</span>
            </button>
          )}

          {!isError && onPause && onResume && (
            <button
              id="pause-resume-upload-btn"
              onClick={isPaused ? onResume : onPause}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
            >
              {isPaused ? <Play className="w-4 h-4 text-emerald-500" /> : <Pause className="w-4 h-4 text-amber-500" />}
              <span>{isPaused ? "Wznów" : "Wstrzymaj"}</span>
            </button>
          )}

          <button
            id="cancel-upload-btn"
            onClick={onCancel}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors ml-auto cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            <span>Anuluj</span>
          </button>
        </div>
      )}
    </div>
  );
};
