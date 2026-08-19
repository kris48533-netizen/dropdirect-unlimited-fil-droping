import React, { useState, useEffect } from "react";
import {
  X,
  HardDrive,
  FolderDown,
  Trash2,
  Settings,
  Shield,
  Zap,
  Copy,
  Check,
  Cpu,
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [askLocation, setAskLocation] = useState<boolean>(() => {
    return localStorage.getItem("dropdirect_ask_location") === "true";
  });

  const [cacheCleared, setCacheCleared] = useState(false);
  const [copiedSettingUrl, setCopiedSettingUrl] = useState(false);
  const [copiedTempCmd, setCopiedTempCmd] = useState(false);

  useEffect(() => {
    localStorage.setItem("dropdirect_ask_location", askLocation ? "true" : "false");
  }, [askLocation]);

  if (!isOpen) return null;

  const handleClearCache = () => {
    try {
      localStorage.removeItem("dropdirect_recent_transfers");
      if ("caches" in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
    } catch (e) {
      // ignore
    }
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2500);
  };

  const copyChromeUrl = () => {
    navigator.clipboard.writeText("chrome://settings/downloads");
    setCopiedSettingUrl(true);
    setTimeout(() => setCopiedSettingUrl(false), 2000);
  };

  const copyWindowsTempGuide = () => {
    navigator.clipboard.writeText("sysdm.cpl");
    setCopiedTempCmd(true);
    setTimeout(() => setCopiedTempCmd(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                Ochrona dysku C: i ustawienia pamięci
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Zapobiegaj zżeraniu miejsca na dysku C: przy wysyłaniu i pobieraniu
              </p>
            </div>
          </div>
          <button
            id="close-settings-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-6 overflow-y-auto text-sm">
          {/* Section 1: Why C: was used and how we fix it */}
          <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs space-y-2 text-amber-950 dark:text-amber-200">
            <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-100">
              <Shield className="w-4 h-4 text-amber-600" />
              <span>Dlaczego przeglądarka zajmuje miejsce na dysku C:?</span>
            </div>
            <p className="leading-relaxed">
              Gdy przeciągasz duży plik do przeglądarki, system Windows standardowo kopiuje go do folderu pamięci podręcznej (<strong>C:\Users\...\AppData\Local\Temp</strong>).
              Aplikacja DropDirect oferuje teraz <strong>Tryb Bezpośredni Zero-Cache</strong>, który czyta plik wprost z dysku D:\ lub E:\ bez kopiowania na dysk C:.
            </p>
          </div>

          {/* Section 2: Direct Disk Choice (Download) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-blue-500" />
              <span>Pobieranie: Wybór dysku zapisu</span>
            </h4>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/80 dark:border-zinc-800 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="ask-location-toggle"
                  checked={askLocation}
                  onChange={(e) => setAskLocation(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500"
                />
                <div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                    Zawsze pytaj o dysk i folder zapisu (D:, E:, Pendrive)
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 block mt-0.5 leading-relaxed">
                    Pobierany plik zapisze się bezpośrednio w wybranym miejscu, <strong>nie zabierając miejsca na dysku C:</strong>.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Section 3: Browser Download Directory Guide */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <FolderDown className="w-4 h-4 text-indigo-500" />
              <span>Zmiana domyślnego folderu przeglądarki na dysk D:\</span>
            </h4>

            <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs space-y-2 text-blue-950 dark:text-blue-200">
              <ol className="list-decimal list-inside space-y-1.5 text-blue-900/90 dark:text-blue-300">
                <li>Otwórz ustawienia pobierania w Chrome / Edge.</li>
                <li>Kliknij <strong>Zmień lokalizację</strong> i wybierz folder na dysku <strong>D:\ lub E:\</strong>.</li>
                <li>Włącz opcję <em>„Pytaj przed pobraniem, gdzie zapisać każdy plik”</em>.</li>
              </ol>

              <div className="pt-1.5 flex items-center gap-2">
                <button
                  onClick={copyChromeUrl}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedSettingUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSettingUrl ? "Skopiowano!" : "Kopiuj chrome://settings/downloads"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Windows TEMP relocation guide */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-500" />
              <span>Jak przenieść folder Temp systemu Windows z C: na D:</span>
            </h4>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs space-y-2 text-zinc-600 dark:text-zinc-300">
              <p>
                Jeśli chcesz, aby <strong>żaden program w Windows</strong> nie tworzył tymczasowych plików na C::
              </p>
              <ol className="list-decimal list-inside space-y-1 text-zinc-500 dark:text-zinc-400 text-[11px]">
                <li>Wciśnij <kbd className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded font-mono">Win + R</kbd>, wpisz <code className="text-blue-600 dark:text-blue-400 font-mono font-bold">sysdm.cpl</code> i kliknij Enter.</li>
                <li>Przejdź do zakładki <strong>Zaawansowane</strong> → <strong>Zmienne środowiskowe</strong>.</li>
                <li>W zmiennych użytkownika zaznacz <code>TEMP</code> i <code>TMP</code> i zmień ich wartość np. na <code>D:\Temp</code>.</li>
              </ol>

              <div className="pt-1">
                <button
                  onClick={copyWindowsTempGuide}
                  className="px-2.5 py-1.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedTempCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedTempCmd ? "Skopiowano sysdm.cpl" : "Kopiuj polecenie sysdm.cpl"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 5: Clean application Cache */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4 text-red-500" />
              <span>Czyszczenie pamięci podręcznej</span>
            </h4>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 block">
                  Zwolnij bufor w pamięci
                </span>
                <span className="text-[11px] text-zinc-500 block">
                  Usuwa aktywne wskaźniki i zwalnia zasoby w przeglądarce.
                </span>
              </div>

              <button
                id="clear-cache-btn"
                onClick={handleClearCache}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 transition-colors shrink-0 cursor-pointer"
              >
                {cacheCleared ? "Wyczyszczono!" : "Wyczyść bufor"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end">
          <button
            id="save-settings-btn"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            Gotowe
          </button>
        </div>
      </div>
    </div>
  );
};
