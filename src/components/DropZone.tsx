import React, { useRef, useState } from "react";
import {
  UploadCloud,
  File as FileIcon,
  X,
  Plus,
  HardDrive,
  CheckCircle2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { TransferFile } from "../types";
import { formatBytes } from "../utils/formatters";

interface DropZoneProps {
  files: TransferFile[];
  onFilesSelected: (files: File[], customHandle?: any) => void;
  onRemoveFile: (id: string) => void;
  onClearAll: () => void;
  onProceed: () => void;
  disabled?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  files,
  onFilesSelected,
  onRemoveFile,
  onClearAll,
  onProceed,
  disabled,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      onFilesSelected(droppedFiles);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      onFilesSelected(selected);
    }
  };

  // Direct disk picker (bypasses C:\ Windows staging cache completely)
  const handleDirectDiskPicker = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;

    if ("showOpenFilePicker" in window) {
      try {
        const fileHandles = await (window as any).showOpenFilePicker({
          multiple: true,
        });

        const filesLoaded: File[] = [];
        for (const handle of fileHandles) {
          const file = await handle.getFile();
          filesLoaded.push(file);
        }

        if (filesLoaded.length > 0) {
          onFilesSelected(filesLoaded, fileHandles[0]);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          // Fallback to standard input
          fileInputRef.current?.click();
        }
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="w-full space-y-4">
      {/* Direct Disk Mode Prompt */}
      <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-blue-950 dark:text-blue-200">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold block">
              Wysyłanie z dysku D:\, E:\ bez zajmowania miejsca na C:\
            </span>
            <span className="text-zinc-600 dark:text-zinc-400 text-[11px]">
              Wybierz plik w trybie bezpośrednim – przeglądarka nie skopiuje go do pamięci tymczasowej dysku C:.
            </span>
          </div>
        </div>

        <button
          id="direct-disk-open-btn"
          type="button"
          onClick={handleDirectDiskPicker}
          disabled={disabled}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold rounded-xl shrink-0 flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>Wybierz z dysku D: / E:</span>
        </button>
      </div>

      {/* Drag & Drop Area */}
      <div
        id="file-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`relative group cursor-pointer border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all duration-200 ${
          isDragOver
            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[1.01]"
            : "border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/40 hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
          disabled={disabled}
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
            <UploadCloud className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <p className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Przeciągnij i upuść plik lub{" "}
              <span className="text-blue-600 dark:text-blue-400 underline underline-offset-2">
                przeglądaj dysk
              </span>
            </p>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              Obsługuje pliki o dowolnym rozmiarze (1 GB, 20 GB, 100 GB+). Strumieniowanie odbywa się fragmentami bez przeciążania pamięci.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <span className="flex items-center gap-1 bg-white dark:bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-700">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Brak duplikacji na C:
            </span>
            <span className="flex items-center gap-1 bg-white dark:bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
              Wszystkie formaty (ZIP, ISO, Wideo, Gry)
            </span>
          </div>
        </div>
      </div>

      {/* Selected Files List */}
      {files.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-zinc-500" />
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Wybrane pliki ({files.length})
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                {formatBytes(totalSize)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="add-more-files-btn"
                type="button"
                onClick={handleDirectDiskPicker}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Dodaj więcej
              </button>
              <button
                id="clear-all-files-btn"
                type="button"
                onClick={onClearAll}
                className="text-xs text-zinc-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
              >
                Wyczyść
              </button>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 pr-1 space-y-1">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between py-2.5 px-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 rounded-lg group"
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                    <FileIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                </div>

                <button
                  id={`remove-file-${file.id}`}
                  onClick={() => onRemoveFile(file.id)}
                  className="p-1 text-zinc-400 hover:text-red-500 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Usuń plik"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <button
              id="generate-share-link-btn"
              onClick={onProceed}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Prześlij i wygeneruj natychmiastowy link</span>
              <span className="text-xs bg-blue-700/80 px-2 py-0.5 rounded-full font-medium">
                {formatBytes(totalSize)}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
