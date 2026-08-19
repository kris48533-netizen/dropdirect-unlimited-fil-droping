import React from "react";
import { Infinity, Zap, DownloadCloud, Clock, ShieldCheck, CheckCircle2 } from "lucide-react";

export const FeatureExplainer: React.FC = () => {
  return (
    <div className="w-full mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          Dlaczego to najwygodniejszy sposób na przesyłanie dużych plików?
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Wrzucasz plik, zamykasz kartę – Twój znajomy pobiera go natychmiast za pomocą jednego kliknięcia.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <DownloadCloud className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
            Możesz od razu zamknąć kartę
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Nie musisz czekać, aż znajomy wejdzie na stronę. Po przesłaniu plik jest bezpiecznie gotowy, a Ty możesz wyłączyć przeglądarkę lub komputer.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Infinity className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
            Brak sztucznych limitów GB
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Strumieniowe przesyłanie fragmentów (chunking) pozwala wrzucać duże wideo 4K, instalatory gier, archiwa ZIP i archiwa o dowolnej wielkości.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
            Natychmiastowe pobieranie
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Odbiorca klika w link i pobieranie rusza w ułamku sekundy z maksymalną prędkością łącza i obsługą menedżerów pobierania.
          </p>
        </div>
      </div>
    </div>
  );
};
