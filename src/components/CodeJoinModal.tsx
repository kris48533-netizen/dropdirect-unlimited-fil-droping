import React, { useState } from "react";
import { X, KeyRound, Download, Link2, Sparkles } from "lucide-react";
import { extractIdentifierFromInput } from "../utils/formatters";

interface CodeJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (identifier: string) => void;
}

export const CodeJoinModal: React.FC<CodeJoinModalProps> = ({ isOpen, onClose, onJoin }) => {
  const [inputVal, setInputVal] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = extractIdentifierFromInput(inputVal);
    if (!clean || clean.length < 3) {
      setError("Wklej prawidłowy link do pliku lub wpisz 6-cyfrowy kod odbioru");
      return;
    }
    setError("");
    onJoin(clean);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (pasted) {
      const extracted = extractIdentifierFromInput(pasted);
      if (extracted) {
        setInputVal(pasted.trim());
        setError("");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Link2 className="w-4 h-4" />
            </div>
            <span>Wklej link lub kod do pliku</span>
          </div>
          <button
            id="close-join-modal-btn"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
              Wklej cały link (URL) lub podaj 6-cyfrowy kod
            </label>
            <div className="relative">
              <input
                id="join-transfer-code-input"
                type="text"
                placeholder="Wklej link https://... lub kod np. 482-190"
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  if (error) setError("");
                }}
                onPaste={handlePaste}
                autoFocus
                className="w-full text-center text-sm sm:text-base font-mono font-medium py-3.5 px-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-zinc-400 placeholder:text-xs sm:placeholder:text-sm"
              />
            </div>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
            <span>Automatycznie rozpoznaje skopiowane linki i kody odbioru.</span>
          </p>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Anuluj
            </button>
            <button
              id="submit-join-code-btn"
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Otwórz i pobierz</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
