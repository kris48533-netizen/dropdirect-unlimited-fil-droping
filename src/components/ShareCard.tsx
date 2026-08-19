import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Copy,
  Check,
  QrCode,
  Link2,
  KeyRound,
  Download,
  CheckCircle2,
  Globe2,
  Send,
  UploadCloud,
  Share2,
} from "lucide-react";
import { formatCode } from "../utils/formatters";

interface ShareCardProps {
  code: string;
  shareUrl: string;
  downloadUrl: string;
  fileName: string;
  totalSizeText: string;
  uploadPercent?: number;
  uploadStatus?: string;
  onSendNewFile: () => void;
}

export const ShareCard: React.FC<ShareCardProps> = ({
  code,
  shareUrl,
  downloadUrl,
  fileName,
  totalSizeText,
  uploadPercent = 100,
  uploadStatus = "upload_complete",
  onSendNewFile,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const isSyncing = uploadPercent < 100 && uploadStatus === "uploading";

  useEffect(() => {
    if (shareUrl) {
      QRCode.toDataURL(shareUrl, {
        margin: 1,
        width: 260,
        color: {
          dark: "#09090b",
          light: "#ffffff",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("QR generation error:", err));
    }
  }, [shareUrl]);

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Pobierz plik: ${fileName}`,
          text: `Pobierz plik ${fileName} (${totalSizeText}) przez DropDirect`,
          url: shareUrl,
        });
      } catch {
        copyLink();
      }
    } else {
      copyLink();
    }
  };

  return (
    <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 mb-2 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Link do pobrania wygenerowany natychmiast!</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Wyślij ten link lub kod znajomemu
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Plik: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{fileName}</span> ({totalSizeText})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-blue-500" />
            <span>Udostępnij</span>
          </button>
        </div>
      </div>

      {/* Background sync progress indicator */}
      {isSyncing ? (
        <div className="p-4 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-blue-900 dark:text-blue-200 font-semibold">
            <span className="flex items-center gap-1.5">
              <UploadCloud className="w-4 h-4 text-blue-600 animate-pulse" />
              <span>Zapisywanie w tle ({uploadPercent.toFixed(0)}%) – możesz już wysłać link!</span>
            </span>
            <span className="font-mono font-bold">{uploadPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2 bg-blue-200/50 dark:bg-blue-900/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(2, uploadPercent)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
            Plik jest w pełni zabezpieczony na serwerze – możesz od razu zamknąć tę kartę, a znajomy pobierze go w dowolnej chwili.
          </p>
        </div>
      )}

      {/* 2 Main Sharing Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Share by URL */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200/80 dark:border-zinc-700/80 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            <Link2 className="w-3.5 h-3.5 text-blue-500" />
            <span>Opcja 1: Link dla znajomego</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 font-mono truncate select-all"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              id="copy-share-link-btn"
              onClick={copyLink}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow-sm cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? "Skopiowano!" : "Kopiuj"}</span>
            </button>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Wklej ten link w wiadomości na Messengerze, WhatsAppie, Discordzie lub SMS-ie.
          </p>
        </div>

        {/* Share by 6-Digit Code */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200/80 dark:border-zinc-700/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <KeyRound className="w-3.5 h-3.5 text-blue-500" />
              <span>Opcja 2: 6-cyfrowy kod odbioru</span>
            </div>
            <button
              id="toggle-qr-code-btn"
              onClick={() => setShowQR(!showQR)}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{showQR ? "Ukryj QR" : "Pokaż QR"}</span>
            </button>
          </div>

          <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2">
            <span className="text-xl font-extrabold tracking-widest text-zinc-900 dark:text-zinc-100 font-mono">
              {formatCode(code)}
            </span>
            <button
              id="copy-share-code-btn"
              onClick={copyCode}
              className="flex items-center gap-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? "Skopiowano" : "Kopiuj kod"}</span>
            </button>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Podaj ten kod znajomemu – wpisze go w okienku „Odbierz kodem”.
          </p>
        </div>
      </div>

      {/* QR Code expansion */}
      {showQR && qrDataUrl && (
        <div className="flex flex-col items-center justify-center p-5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 space-y-2">
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Zeskanuj aparatem w smartfonie, aby natychmiast otworzyć plik
          </p>
          <div className="p-3 bg-white rounded-xl shadow-sm border border-zinc-200">
            <img src={qrDataUrl} alt="Kod QR transferu" className="w-48 h-48" referrerPolicy="no-referrer" />
          </div>
        </div>
      )}

      {/* Bottom action buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <button
          id="test-download-btn"
          onClick={() => {
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              if (a.parentNode) a.parentNode.removeChild(a);
            }, 2000);
          }}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Przetestuj pobieranie samemu</span>
        </button>

        <button
          id="send-another-file-btn"
          onClick={onSendNewFile}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>Wyślij kolejny plik</span>
        </button>
      </div>
    </div>
  );
};
