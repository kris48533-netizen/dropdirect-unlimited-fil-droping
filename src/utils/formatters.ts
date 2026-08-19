export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return "0 KB/s";
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "--";
  if (seconds < 60) return `${Math.ceil(seconds)} s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins < 60) return `${mins} min ${secs} s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours} godz ${remMins} min`;
}

export function formatCode(code: string): string {
  const clean = code.replace(/\D/g, "");
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}`;
}

export function extractIdentifierFromInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  // Check if it's a full or partial URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.includes("?")) {
    try {
      const url = new URL(trimmed, window.location.origin);
      const code = url.searchParams.get("code");
      if (code) return code.replace(/\D/g, "");
      const file = url.searchParams.get("file") || url.searchParams.get("room");
      if (file) return file;

      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        const last = parts[parts.length - 1];
        if (last && last !== "api" && last !== "download" && last !== "file") {
          return last;
        }
      }
    } catch {
      const codeMatch = trimmed.match(/[?&]code=([0-9-]+)/);
      if (codeMatch) return codeMatch[1].replace(/\D/g, "");
      const fileMatch = trimmed.match(/[?&]file=([a-zA-Z0-9_-]+)/);
      if (fileMatch) return fileMatch[1];
    }
  }

  // If contains digits that look like a 6-digit code
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length === 6) {
    return digitsOnly;
  }

  return trimmed;
}

