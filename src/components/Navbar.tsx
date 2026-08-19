import React from "react";
import { ShieldCheck, Zap, Download, RefreshCw, Settings, HardDrive } from "lucide-react";

interface NavbarProps {
  onOpenCodeModal: () => void;
  onOpenSettingsModal: () => void;
  onReset: () => void;
  isReceiving?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCodeModal,
  onOpenSettingsModal,
  onReset,
  isReceiving,
}) => {
  return (
    <header className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <button
          id="nav-logo-btn"
          onClick={onReset}
          className="flex items-center gap-2.5 text-left group focus:outline-none cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-zinc-100">
                DropDirect
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                Bez limitu GB
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
              Szybkie przesyłanie plików
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Bezpieczny transfer</span>
          </div>

          <button
            id="open-settings-btn"
            onClick={onOpenSettingsModal}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            title="Ustawienia dysku i pobierania"
          >
            <HardDrive className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">Dysk & Ustawienia</span>
          </button>

          {!isReceiving && (
            <button
              id="open-join-code-btn"
              onClick={onOpenCodeModal}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Odbierz kodem</span>
            </button>
          )}

          {isReceiving && (
            <button
              id="nav-send-new-btn"
              onClick={onReset}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Wyślij plik</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
