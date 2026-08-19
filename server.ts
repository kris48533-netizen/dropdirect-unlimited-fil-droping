import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

interface StoredFileMeta {
  id: string;
  code: string;
  name: string;
  size: number;
  type: string;
  totalChunks: number;
  uploadedChunks: number;
  uploadedBytes: number;
  createdAt: number;
  ready: boolean;
  filePath: string;
}

const UPLOAD_DIR = path.join(process.cwd(), ".uploads_cache");
const REGISTRY_FILE = path.join(UPLOAD_DIR, "registry.json");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

process.on("uncaughtException", (err) => {
  console.error("[CRITICAL] Uncaught exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[CRITICAL] Unhandled rejection at:", promise, "reason:", reason);
});

const storedFiles = new Map<string, StoredFileMeta>();
const codeToFileId = new Map<string, string>();

// Load registry from disk on startup
function loadRegistry() {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const data = fs.readFileSync(REGISTRY_FILE, "utf-8");
      const list: StoredFileMeta[] = JSON.parse(data);
      for (const item of list) {
        // Ensure path points to current UPLOAD_DIR
        const safeExt = path.extname(item.name || "") || "";
        const expectedPath = path.join(UPLOAD_DIR, `${item.id}${safeExt}`);
        const finalPath = fs.existsSync(item.filePath) ? item.filePath : expectedPath;
        
        if (!fs.existsSync(finalPath)) {
          try {
            fs.writeFileSync(finalPath, Buffer.alloc(0));
          } catch {
            // ignore
          }
        }

        item.filePath = finalPath;
        storedFiles.set(item.id, item);
        codeToFileId.set(item.code, item.id);
      }
      console.log(`Loaded ${storedFiles.size} persistent files from disk.`);
    }
  } catch (err) {
    console.error("Failed to load file registry:", err);
  }
}

// Save registry to disk
function saveRegistry() {
  try {
    const list = Array.from(storedFiles.values());
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save file registry:", err);
  }
}

loadRegistry();

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API Middleware & Routes with CORS
  app.use("/api", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Disposition, Accept-Ranges");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", activeFiles: storedFiles.size });
  });

  // 1. Init Upload Session (Persistent & Non-expiring)
  app.post("/api/upload/init", (req, res) => {
    try {
      const { name, size, type, totalChunks, customCode } = req.body || {};
      if (!name || typeof size !== "number") {
        return res.status(400).json({ error: "Nieprawidłowe dane pliku" });
      }

      const fileId = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      const cleanCode = (customCode || Math.floor(100000 + Math.random() * 900000).toString())
        .replace(/-/g, "")
        .trim();

      const safeExt = path.extname(name);
      const diskFileName = `${fileId}${safeExt}`;
      const filePath = path.join(UPLOAD_DIR, diskFileName);

      // Pre-allocate file with full size on disk
      const fd = fs.openSync(filePath, "w");
      if (size > 0) {
        fs.ftruncateSync(fd, size);
      }
      fs.closeSync(fd);

      const meta: StoredFileMeta = {
        id: fileId,
        code: cleanCode,
        name,
        size,
        type: type || "application/octet-stream",
        totalChunks: Math.max(1, totalChunks || 1),
        uploadedChunks: 0,
        uploadedBytes: 0,
        createdAt: Date.now(),
        ready: false,
        filePath,
      };

      storedFiles.set(fileId, meta);
      codeToFileId.set(cleanCode, fileId);
      saveRegistry();

      return res.json({
        fileId,
        code: cleanCode,
        message: "Sesja przesyłania zainicjalizowana",
      });
    } catch (err: any) {
      console.error("Error in /api/upload/init:", err);
      return res.status(500).json({ error: err.message || "Błąd inicjalizacji pliku" });
    }
  });

  // 2. Upload Chunk with Offset-Based Direct Disk Writing
  app.post(
    "/api/upload/chunk",
    express.raw({ type: ["application/octet-stream", "*/*"], limit: "100mb" }),
    (req, res) => {
      try {
        const fileId = req.query.fileId as string;
        const offset = parseInt((req.query.offset as string) || "0", 10);
        const totalChunks = parseInt((req.query.totalChunks as string) || "1", 10);

        const fileMeta = storedFiles.get(fileId);
        if (!fileMeta) {
          return res.status(404).json({ error: "Sesja przesyłania nie istnieje" });
        }

        const chunkBuffer = req.body;
        if (!chunkBuffer || !Buffer.isBuffer(chunkBuffer) || chunkBuffer.length === 0) {
          return res.status(400).json({ error: "Pusty fragment danych" });
        }

        let fd: number | null = null;
        try {
          fd = fs.openSync(fileMeta.filePath, "r+");
          fs.writeSync(fd, chunkBuffer, 0, chunkBuffer.length, offset);
        } finally {
          if (fd !== null) {
            try {
              fs.closeSync(fd);
            } catch {}
          }
        }

        fileMeta.uploadedChunks += 1;
        fileMeta.uploadedBytes += chunkBuffer.length;

        if (fileMeta.uploadedBytes >= fileMeta.size || fileMeta.uploadedChunks >= totalChunks) {
          fileMeta.ready = true;
          saveRegistry();
        }

        return res.json({
          success: true,
          uploadedBytes: fileMeta.uploadedBytes,
          uploadedChunks: fileMeta.uploadedChunks,
          isComplete: fileMeta.ready,
        });
      } catch (err: any) {
        console.error("Error writing chunk at offset:", err);
        return res.status(500).json({ error: "Błąd zapisu fragmentu danych na serwerze" });
      }
    }
  );

  // 3. Finalize upload with disk sync flush
  app.post("/api/upload/complete", (req, res) => {
    try {
      const fileId = ((req.body && req.body.fileId) || req.query.fileId || (req.params as any)?.fileId) as string;
      if (!fileId) {
        return res.status(400).json({ error: "Brak identyfikatora pliku" });
      }

      const fileMeta = resolveFile(fileId);

      if (!fileMeta) {
        return res.status(404).json({ error: "Nie znaleziono pliku lub sesja wygasła" });
      }

      try {
        if (fs.existsSync(fileMeta.filePath)) {
          const fd = fs.openSync(fileMeta.filePath, "r+");
          fs.fsyncSync(fd);
          fs.closeSync(fd);
        }
      } catch (e) {
        // ignore
      }

      fileMeta.ready = true;
      saveRegistry();

      return res.json({
        success: true,
        fileId: fileMeta.id,
        code: fileMeta.code,
        name: fileMeta.name,
        size: fileMeta.size,
        downloadUrl: `/api/download/${fileMeta.id}`,
      });
    } catch (err: any) {
      console.error("Error in /api/upload/complete:", err);
      return res.status(500).json({ error: err.message || "Błąd finalizowania pliku" });
    }
  });

  // 3.5 Check Upload Status / Resume Check
  app.get("/api/upload/status/:fileId", (req, res) => {
    const { fileId } = req.params;
    const fileMeta = resolveFile(fileId);

    if (!fileMeta) {
      return res.status(404).json({ error: "Sesja nie istnieje" });
    }

    return res.json({
      fileId: fileMeta.id,
      uploadedBytes: fileMeta.uploadedBytes,
      uploadedChunks: fileMeta.uploadedChunks,
      totalChunks: fileMeta.totalChunks,
      size: fileMeta.size,
      ready: fileMeta.ready,
    });
  });

  // Helper function to resolve file by any ID or Code
  function resolveFile(rawInput: string): StoredFileMeta | null {
    if (!rawInput) return null;
    const trimmed = rawInput.trim();
    
    // Direct ID match
    if (storedFiles.has(trimmed)) {
      return storedFiles.get(trimmed)!;
    }

    // Code match
    const cleanDigits = trimmed.replace(/\D/g, "");
    if (cleanDigits && codeToFileId.has(cleanDigits)) {
      const id = codeToFileId.get(cleanDigits);
      if (id && storedFiles.has(id)) {
        return storedFiles.get(id)!;
      }
    }

    // Fuzzy search through stored files
    const lower = trimmed.toLowerCase();
    for (const [id, meta] of storedFiles.entries()) {
      if (
        id.toLowerCase() === lower ||
        meta.id.toLowerCase() === lower ||
        meta.code === cleanDigits ||
        meta.code === trimmed ||
        meta.name.toLowerCase() === lower
      ) {
        return meta;
      }
    }

    return null;
  }

  // 4. Get File Info by ID or 6-digit Code
  app.get(["/api/file", "/api/file/:identifier"], (req, res) => {
    const rawIdentifier = (req.params.identifier || req.query.code || req.query.id || req.query.file) as string;
    const fileMeta = resolveFile(rawIdentifier);

    if (!fileMeta) {
      return res.status(404).json({ error: "Plik nie został znaleziony" });
    }

    return res.json({
      id: fileMeta.id,
      code: fileMeta.code,
      name: fileMeta.name,
      size: fileMeta.size,
      type: fileMeta.type,
      ready: fileMeta.ready,
      downloadUrl: `/api/download/${fileMeta.id}`,
      createdAt: fileMeta.createdAt,
    });
  });

  // 5. High-Speed Turbo Multi-Threaded Chunk Slice API
  app.get("/api/download/chunk", (req, res) => {
    const fileId = (req.query.fileId || req.query.id || req.query.code) as string;
    const start = parseInt(req.query.start as string, 10);
    const end = parseInt(req.query.end as string, 10);

    const fileMeta = resolveFile(fileId);
    if (!fileMeta) {
      return res.status(404).json({ error: "Plik nie istnieje" });
    }

    if (!fs.existsSync(fileMeta.filePath)) {
      try {
        fs.writeFileSync(fileMeta.filePath, Buffer.alloc(0));
      } catch {}
    }

    const stat = fs.statSync(fileMeta.filePath);
    const fileSize = stat.size;

    if (isNaN(start) || isNaN(end) || start < 0 || end >= fileSize || start > end) {
      return res.status(416).json({ error: "Nieprawidłowy zakres" });
    }

    const chunkSize = end - start + 1;
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", chunkSize.toString());
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Accept-Ranges", "bytes");

    if (req.socket) {
      req.socket.setNoDelay(true);
      req.socket.setTimeout(0);
    }

    // Direct synchronous low-latency chunk buffer delivery for turbo speed
    let fd: number | null = null;
    try {
      const buffer = Buffer.allocUnsafe(chunkSize);
      fd = fs.openSync(fileMeta.filePath, "r");
      fs.readSync(fd, buffer, 0, chunkSize, start);
      res.end(buffer);
    } catch {
      const stream = fs.createReadStream(fileMeta.filePath, {
        start,
        end,
        highWaterMark: 2 * 1024 * 1024,
      });
      stream.pipe(res);
    } finally {
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch {}
      }
    }
  });

  // 6. Direct Full File / Range Download Stream (RFC 7233 & Browser Native)
  app.get(["/api/download", "/api/download/:fileId"], async (req, res) => {
    const rawIdentifier = (req.params.fileId || req.query.fileId || req.query.code || req.query.id || req.query.file) as string;
    const fileMeta = resolveFile(rawIdentifier);

    if (!fileMeta) {
      return res.status(404).send("Plik nie został znaleziony lub link wygasł.");
    }

    // Wait if sender is still pushing chunks
    if (!fileMeta.ready && fileMeta.size > 0) {
      let waitCount = 0;
      while (waitCount < 60) {
        const currentMeta = storedFiles.get(fileMeta.id);
        if (currentMeta?.ready || (currentMeta && currentMeta.uploadedBytes >= fileMeta.size)) {
          break;
        }
        await new Promise((r) => setTimeout(r, 250));
        waitCount++;
      }
    }

    if (!fs.existsSync(fileMeta.filePath)) {
      return res.status(404).send("Plik nie istnieje na serwerze.");
    }

    // Standard high-compatibility Express download
    res.setHeader("Cache-Control", "no-cache");
    return res.download(fileMeta.filePath, fileMeta.name, (err) => {
      if (err && !res.headersSent) {
        console.error("Download stream notification:", err);
      }
    });
  });

  // Explicit 404 for any unmatched /api/* requests so they NEVER fall through to Vite SPA
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Nie znaleziono ścieżki API: ${req.method} ${req.originalUrl}` });
  });

  // Vite middleware for development (serves index.html, react assets, and SPA fallback)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler (must be at the very end)
  app.use((err: any, req: any, res: any, _next: any) => {
    console.error("Global Server Error:", err);
    if (req.path.startsWith("/api")) {
      return res.status(500).json({ error: err?.message || "Błąd wewnętrzny serwera" });
    }
    res.status(500).send("Błąd serwera");
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`DropDirect Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
