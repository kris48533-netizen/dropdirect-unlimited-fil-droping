import React, { useState, useEffect, useRef } from "react";
import { Navbar } from "./components/Navbar";
import { DropZone } from "./components/DropZone";
import { ShareCard } from "./components/ShareCard";
import { TransferProgress } from "./components/TransferProgress";
import { ReceiveView } from "./components/ReceiveView";
import { CodeJoinModal } from "./components/CodeJoinModal";
import { SettingsModal } from "./components/SettingsModal";
import { FeatureExplainer } from "./components/FeatureExplainer";
import { TransferFile, TransferStats, TransferStatus, StoredFileResponse } from "./types";
import { formatBytes, extractIdentifierFromInput } from "./utils/formatters";
import { ChunkedUploader } from "./utils/uploader";
import { Link2, Download, Sparkles } from "lucide-react";

export default function App() {
  // Mode State
  const [role, setRole] = useState<"sender" | "receiver">("sender");
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [homeLinkInput, setHomeLinkInput] = useState<string>("");

  // Uploaded / Created File State
  const [fileId, setFileId] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [uploadedFileSize, setUploadedFileSize] = useState<number>(0);

  // Files selected by user
  const [selectedFiles, setSelectedFiles] = useState<TransferFile[]>([]);
  const customHandleRef = useRef<any>(null);

  // Receiver State
  const [incomingFile, setIncomingFile] = useState<StoredFileResponse | null>(null);
  const [isLoadingIncoming, setIsLoadingIncoming] = useState<boolean>(false);

  // Transfer & Upload Progress State
  const [transferStatus, setTransferStatus] = useState<TransferStatus>("idle");
  const [transferStats, setTransferStats] = useState<TransferStats>({
    bytesTransferred: 0,
    totalBytes: 0,
    percent: 0,
    speedBytesPerSec: 0,
    timeRemainingSec: 0,
    currentFileIndex: 0,
    totalFiles: 1,
    currentFileName: "",
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Uploader ref
  const uploaderRef = useRef<ChunkedUploader | null>(null);

  // Check URL on initial load for code or fileId
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get("code") || params.get("c");
    const fileParam = params.get("file") || params.get("f") || params.get("id") || params.get("room");

    let identifier = codeParam || fileParam;

    // Check pathname if no query param (e.g. /123456 or /c/123456)
    if (!identifier && window.location.pathname && window.location.pathname !== "/") {
      const parts = window.location.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        const last = parts[parts.length - 1];
        if (last && !["api", "download", "file", "share"].includes(last.toLowerCase())) {
          identifier = last;
        }
      }
    }

    if (identifier) {
      loadIncomingFile(identifier);
    }
  }, []);

  const loadIncomingFile = async (rawIdentifier: string) => {
    const identifier = extractIdentifierFromInput(rawIdentifier);
    if (!identifier) return;

    setRole("receiver");
    setIsLoadingIncoming(true);
    setErrorMessage(null);

    // Update URL bar cleanly
    try {
      const url = new URL(window.location.href);
      if (/^\d{6}$/.test(identifier)) {
        url.searchParams.set("code", identifier);
      } else {
        url.searchParams.set("file", identifier);
      }
      window.history.pushState({}, "", url.toString());
    } catch {
      // ignore
    }

    let attempts = 0;
    const maxAttempts = 3;
    let lastError = "Nie znaleziono pliku lub sesja wygasła.";

    while (attempts < maxAttempts) {
      try {
        const res = await fetch(`/api/file/${encodeURIComponent(identifier)}`);
        const text = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Serwer przetwarza dane pliku...");
        }

        if (res.ok && data.id) {
          setIncomingFile(data);
          setCode(data.code || identifier);
          setIsLoadingIncoming(false);
          return;
        } else {
          lastError = data.error || "Plik nie został jeszcze znaleziony";
        }
      } catch (err: any) {
        lastError = err.message || "Błąd wczytywania";
      }

      attempts++;
      if (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 600 * attempts));
      }
    }

    setErrorMessage(lastError);
    setIsLoadingIncoming(false);
  };

  // Handle files chosen by sender
  const handleFilesSelected = (files: File[], customHandle?: any) => {
    if (customHandle) {
      customHandleRef.current = customHandle;
    }
    const newItems: TransferFile[] = files.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      file,
    }));
    setSelectedFiles((prev) => [...prev, ...newItems]);
    setErrorMessage(null);
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    customHandleRef.current = null;
  };

  // Start fast chunked upload
  const handleStartUpload = async () => {
    if (selectedFiles.length === 0) return;

    setErrorMessage(null);
    const firstFile = selectedFiles[0];
    setUploadedFileName(firstFile.name);
    setUploadedFileSize(firstFile.size);
    setTransferStatus("uploading");

    const uploader = new ChunkedUploader({
      onInit: ({ fileId: initFileId, code: initCode, downloadUrl: initDownloadUrl }) => {
        setFileId(initFileId);
        setCode(initCode);
        setDownloadUrl(initDownloadUrl);
        setTransferStatus("upload_complete");
      },
      onProgress: (stats) => {
        setTransferStats(stats);
      },
      onStatusChange: (status) => {
        if (status === "upload_complete") {
          setTransferStatus("upload_complete");
        }
      },
      onError: (err) => {
        console.warn("Background upload status:", err);
      },
    });

    uploaderRef.current = uploader;

    try {
      const result = await uploader.upload(selectedFiles, customHandleRef.current);
      setFileId(result.fileId);
      setCode(result.code);
      setDownloadUrl(result.downloadUrl);
      setTransferStatus("upload_complete");
    } catch (err: any) {
      console.error("Upload error:", err);
      setErrorMessage(err.message || "Błąd podczas przesyłania pliku");
      setTransferStatus("error");
    }
  };

  // Join by 6-digit code
  const handleJoinByCode = (enteredCode: string) => {
    setIsCodeModalOpen(false);
    loadIncomingFile(enteredCode);
  };

  // Reset to home / new upload
  const handleReset = () => {
    if (uploaderRef.current) {
      uploaderRef.current.cancel();
    }
    window.history.pushState({}, "", window.location.pathname);
    setRole("sender");
    setFileId("");
    setCode("");
    setDownloadUrl("");
    setSelectedFiles([]);
    customHandleRef.current = null;
    setIncomingFile(null);
    setTransferStatus("idle");
    setErrorMessage(null);
  };

  const shareUrl = code
    ? `${window.location.origin}/?code=${code}`
    : fileId
    ? `${window.location.origin}/?file=${fileId}`
    : "";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      <Navbar
        onOpenCodeModal={() => setIsCodeModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onReset={handleReset}
        isReceiving={role === "receiver"}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col items-center">
        {/* Error Alert */}
        {errorMessage && (
          <div className="w-full mb-6 p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-center justify-between shadow-sm">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs font-semibold underline ml-3 cursor-pointer"
            >
              Zamknij
            </button>
          </div>
        )}

        {/* Sender - Dropzone & Setup */}
        {role === "sender" && transferStatus === "idle" && (
          <div className="w-full space-y-6">
            <div className="text-center space-y-2 mb-6">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                Wgraj plik bez limitu GB
              </h1>
              <p className="text-base text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
                Prześlij plik o dowolnym rozmiarze. Po przesłaniu otrzymasz link i kod dla znajomego. 
                <strong> Możesz od razu zamknąć kartę</strong> – znajomy pobierze plik natychmiast!
              </p>
            </div>

            {/* Quick Receive Link Bar */}
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                <Link2 className="w-4 h-4 text-blue-500" />
                <span>Masz link lub kod do pliku? Odbierz go tutaj</span>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (homeLinkInput.trim()) {
                    loadIncomingFile(homeLinkInput);
                  }
                }}
                className="flex flex-col sm:flex-row gap-2"
              >
                <input
                  id="home-quick-link-input"
                  type="text"
                  placeholder="Wklej link (https://...) lub wpisz 6-cyfrowy kod odbioru"
                  value={homeLinkInput}
                  onChange={(e) => setHomeLinkInput(e.target.value)}
                  className="flex-1 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <button
                  id="home-quick-link-submit-btn"
                  type="submit"
                  disabled={!homeLinkInput.trim()}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shrink-0 flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Otwórz i pobierz</span>
                </button>
              </form>
            </div>

            <DropZone
              files={selectedFiles}
              onFilesSelected={handleFilesSelected}
              onRemoveFile={handleRemoveFile}
              onClearAll={handleClearAll}
              onProceed={handleStartUpload}
            />

            <FeatureExplainer />
          </div>
        )}

        {/* Sender - Active Uploading or Error/Resume */}
        {role === "sender" && (transferStatus === "uploading" || transferStatus === "paused" || transferStatus === "error") && (
          <div className="w-full max-w-2xl space-y-6">
            <TransferProgress
              stats={transferStats}
              status={transferStatus}
              errorMessage={errorMessage}
              onPause={() => uploaderRef.current?.pause()}
              onResume={() => uploaderRef.current?.resume()}
              onRetry={handleStartUpload}
              onCancel={handleReset}
            />
          </div>
        )}

        {/* Sender - Upload Completed & Share Screen */}
        {role === "sender" && transferStatus === "upload_complete" && (
          <div className="w-full space-y-6">
            <ShareCard
              code={code}
              shareUrl={shareUrl}
              downloadUrl={downloadUrl}
              fileName={uploadedFileName}
              totalSizeText={formatBytes(uploadedFileSize)}
              uploadPercent={transferStats.percent}
              uploadStatus={transferStats.percent >= 100 ? "upload_complete" : "uploading"}
              onSendNewFile={handleReset}
            />
            <FeatureExplainer />
          </div>
        )}

        {/* Receiver - Instant Direct Download Screen */}
        {role === "receiver" && (
          <div className="w-full space-y-6">
            <div className="text-center space-y-2 mb-6">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                Pobieranie pliku
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Plik jest gotowy na serwerze do natychmiastowego pobrania z pełną prędkością Twojego łącza.
              </p>
            </div>

            <ReceiveView
              file={incomingFile}
              code={code}
              onBackToHome={handleReset}
              onOpenSettings={() => setIsSettingsModalOpen(true)}
              isLoading={isLoadingIncoming}
            />

            <FeatureExplainer />
          </div>
        )}
      </main>

      {/* Code Join Modal */}
      <CodeJoinModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        onJoin={handleJoinByCode}
      />

      {/* Settings & Disk Selection Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      {/* Footer */}
      <footer className="w-full border-t border-zinc-200 dark:border-zinc-800 py-6 text-center text-xs text-zinc-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 DropDirect • Bezlimitowe przesyłanie i natychmiastowe pobieranie</p>
          <p className="text-zinc-400">Wygodne, bezpieczne, bez konieczności utrzymywania otwartej karty</p>
        </div>
      </footer>
    </div>
  );
}
