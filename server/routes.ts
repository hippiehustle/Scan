import type { Express } from "express";
import { storage } from "./storage";
import { insertScanSessionSchema, insertScanResultSchema } from "@shared/schema";
import multer from "multer";
import { classifyImage, isImageFile, loadModel, getUnsupportedResult } from "./nsfw-model";
import { classifyWithSentisight, isSentisightEnabled, setSentisightEnabled, checkSentisightAvailability } from "./sentisight";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { loadSites, filterSites, getSiteStats, runProbe, type MaigretSite } from "./osint/probe-service";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export async function registerRoutes(app: Express): Promise<void> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // Scan Sessions
  app.post("/api/scan-sessions", async (req, res) => {
    try {
      const validatedData = insertScanSessionSchema.parse(req.body);
      const session = await storage.createScanSession(validatedData);
      res.json(session);
    } catch (error) {
      res.status(400).json({ message: "Invalid session data" });
    }
  });

  app.get("/api/scan-sessions/active", async (req, res) => {
    try {
      const sessions = await storage.getActiveScanSessions();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active sessions" });
    }
  });

  app.get("/api/scan-sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.getScanSession(id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  app.put("/api/scan-sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.updateScanSession(id, req.body);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to update session" });
    }
  });

  loadModel().catch((err) =>
    console.warn("NSFW model pre-load deferred:", err.message)
  );

  app.post("/api/upload", upload.array("files"), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      let fileMetadataArray: Array<{ relativePath?: string; isProjectFile?: boolean }> = [];
      if (req.body.metadata) {
        try {
          fileMetadataArray = JSON.parse(req.body.metadata);
          if (!Array.isArray(fileMetadataArray)) fileMetadataArray = [];
        } catch {
          fileMetadataArray = [];
        }
      }

      const isFolderScan = req.body.isFolderScan === "true";
      const folderName = req.body.folderName || "";

      const session = await storage.createScanSession({
        userId: null,
        scanType: isFolderScan ? "full" : "quick",
        targetFolders: isFolderScan && folderName ? [folderName] : [],
      });

      const results = [];
      let processedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileType = file.mimetype.startsWith("image/")
          ? "image"
          : file.mimetype.startsWith("video/")
            ? "video"
            : "document";

        const meta = fileMetadataArray[i] || {};

        let prediction;
        if (isImageFile(file.mimetype)) {
          try {
            if (!file.buffer || file.buffer.length === 0) {
              console.error(`Empty buffer for ${file.originalname}`);
              prediction = getUnsupportedResult();
              failedCount++;
            } else {
              console.log(`Scanning ${file.originalname} (${(file.buffer.length / 1024).toFixed(1)}KB, ${file.mimetype})${meta.isProjectFile ? " [PROJECT]" : ""}`);
              if (isSentisightEnabled()) {
                console.log(`Using SentiSight.ai API for ${file.originalname}`);
                prediction = await classifyWithSentisight(file.buffer);
              } else {
                prediction = await classifyImage(
                  file.buffer,
                  session.confidenceThreshold ?? 0.3
                );
              }
            }
          } catch (classifyError: any) {
            console.error(
              `Failed to classify ${file.originalname}:`,
              classifyError?.message || classifyError
            );
            prediction = getUnsupportedResult();
            failedCount++;
          }
        } else {
          prediction = getUnsupportedResult();
        }

        const relativePath = meta.relativePath || file.originalname;
        const result = await storage.createScanResult({
          sessionId: session.id,
          filename: file.originalname,
          filepath: `/uploads/${file.originalname}`,
          fileType,
          isNsfw: prediction.isNsfw,
          confidence: prediction.confidence,
          processed: prediction.supported,
          flagCategory: prediction.flagCategory,
          originalPath: relativePath,
          newPath: null,
          actionTaken: "none",
          isProjectFile: meta.isProjectFile || false,
          relativePath: relativePath,
        });

        results.push(result);
        processedCount++;
      }

      const nsfwCount = results.filter((r) => r.isNsfw).length;
      const projectFileCount = results.filter((r) => r.isProjectFile).length;

      await storage.updateScanSession(session.id, {
        totalFiles: files.length,
        processedFiles: processedCount,
        nsfwFound: nsfwCount,
        status: "completed",
        endTime: new Date(),
      });

      console.log(`Scan complete: ${files.length} files, ${nsfwCount} NSFW detected, ${failedCount} failed, ${projectFileCount} project files`);

      const updatedSession = await storage.getScanSession(session.id);
      res.json({ session: updatedSession || session, results });
    } catch (error: any) {
      console.error("Upload processing error:", error?.message || error);
      res.status(500).json({ message: "Upload failed: " + (error?.message || "Unknown error") });
    }
  });

  // Scan Results
  app.get("/api/scan-results/:sessionId", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const results = await storage.getScanResults(sessionId);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch results" });
    }
  });

  app.get("/api/nsfw-results", async (req, res) => {
    try {
      const sessionId = req.query.sessionId ? parseInt(req.query.sessionId as string) : undefined;
      const results = await storage.getNsfwResults(sessionId);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch NSFW results" });
    }
  });

  // Statistics
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // File Organization
  app.post("/api/organize-files/:sessionId", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const result = await storage.organizeFiles(sessionId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to organize files" });
    }
  });

  app.post("/api/organize-all", async (req, res) => {
    try {
      const result = await storage.organizeAllNsfwFiles();
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to organize files" });
    }
  });

  app.post("/api/organize-custom", async (req, res) => {
    try {
      const { destinationFolder, mode, filterCategories, filterFileTypes, sessionId } = req.body;
      if (!destinationFolder || !mode) {
        return res.status(400).json({ message: "destinationFolder and mode are required" });
      }
      const result = await storage.organizeWithOptions({
        destinationFolder,
        mode,
        filterCategories,
        filterFileTypes,
        sessionId: sessionId ? parseInt(sessionId) : undefined,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to organize files" });
    }
  });

  app.delete("/api/scan-history", async (req, res) => {
    try {
      const result = await storage.clearScanHistory();
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to clear scan history" });
    }
  });

  app.get("/api/scan-sessions", async (req, res) => {
    try {
      const sessions = await storage.getAllScanSessions();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.get("/api/scan-results", async (req, res) => {
    try {
      const results = await storage.getAllResults();
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch results" });
    }
  });

  // Export functionality
  app.get("/api/export/report", async (req, res) => {
    try {
      const sessionId = req.query.sessionId ? parseInt(req.query.sessionId as string) : undefined;
      const nsfwResults = await storage.getNsfwResults(sessionId);
      const stats = await storage.getStats();
      
      const report = {
        timestamp: new Date().toISOString(),
        summary: stats,
        findings: nsfwResults.map(result => ({
          filename: result.filename,
          filepath: result.filepath,
          original_path: result.originalPath,
          new_path: result.newPath,
          type: result.fileType,
          flag_category: result.flagCategory,
          confidence: Math.round(result.confidence * 100),
          action_taken: result.actionTaken,
          detected_at: result.createdAt,
        })),
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="nsfw-scan-report.json"');
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  app.get("/api/admin/sentisight-status", async (req, res) => {
    try {
      const available = await checkSentisightAvailability();
      res.json({ sentisightAvailable: available, enabled: isSentisightEnabled() });
    } catch (error) {
      res.status(500).json({ sentisightAvailable: false, enabled: false });
    }
  });

  app.post("/api/admin/sentisight-toggle", async (req, res) => {
    try {
      const { enabled } = req.body;
      setSentisightEnabled(!!enabled);
      res.json({ success: true, enabled: isSentisightEnabled() });
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle SentiSight" });
    }
  });

  const handleApkDownload = (req: any, res: any) => {
    const path = require("path");
    const fs = require("fs");
    const apkPath = path.join(process.cwd(), "SecureScanner.apk");
    if (!fs.existsSync(apkPath)) {
      return res.status(404).end();
    }
    const stat = fs.statSync(apkPath);
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Disposition", 'attachment; filename="SecureScanner.apk"');
    res.setHeader("Content-Length", stat.size);
    if (req.method === "HEAD") {
      return res.end();
    }
    const stream = fs.createReadStream(apkPath);
    stream.pipe(res);
  };
  app.head("/api/download-apk", handleApkDownload);
  app.get("/api/download-apk", handleApkDownload);

  loadSites();

  app.get("/api/osint/sites", (req, res) => {
    try {
      const stats = getSiteStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to load site data" });
    }
  });

  app.get("/api/osint/sites/list", (req, res) => {
    try {
      const { tags, nsfwOnly, limit } = req.query;
      const tagFilters = tags ? (tags as string).split(",") : [];
      const isNsfwOnly = nsfwOnly === "true";
      const siteLimit = limit ? parseInt(limit as string) : undefined;
      const sites = filterSites(tagFilters, isNsfwOnly, siteLimit);
      res.json(sites.map(s => ({
        name: s.name,
        urlMain: s.urlMain,
        tags: s.tags,
        alexaRank: s.alexaRank,
      })));
    } catch (error) {
      res.status(500).json({ message: "Failed to filter sites" });
    }
  });

  const activeScans = new Map<number, { cancel: boolean }>();

  app.post("/api/osint/scan", async (req, res) => {
    try {
      const { username, tagFilters = [], nsfwOnly = false, siteLimit } = req.body;
      if (!username || typeof username !== "string" || username.trim().length < 1) {
        return res.status(400).json({ message: "Username is required" });
      }

      const sites = filterSites(tagFilters, nsfwOnly, siteLimit);
      if (sites.length === 0) {
        return res.status(400).json({ message: "No sites match the selected filters" });
      }

      const scan = await storage.createOsintScan({
        username: username.trim(),
        status: "active",
        totalSites: sites.length,
        checkedSites: 0,
        foundCount: 0,
        nsfwFoundCount: 0,
        tagFilters: tagFilters,
        endTime: null,
      });

      res.json(scan);

      const scanControl = { cancel: false };
      activeScans.set(scan.id, scanControl);

      const BATCH_SIZE = 15;
      let checked = 0;
      let found = 0;
      let nsfwFound = 0;

      for (let i = 0; i < sites.length; i += BATCH_SIZE) {
        if (scanControl.cancel) break;

        const batch = sites.slice(i, i + BATCH_SIZE);
        const results = await runProbe(username.trim(), batch);

        for (const result of results) {
          await storage.createOsintResult({
            scanId: scan.id,
            siteName: result.siteName,
            siteUrl: result.siteUrl,
            profileUrl: result.profileUrl,
            status: result.status,
            tags: result.tags,
            isNsfw: result.isNsfw,
            responseTime: result.responseTime,
          });

          checked++;
          if (result.status === "found") {
            found++;
            if (result.isNsfw) nsfwFound++;
          }
        }

        await storage.updateOsintScan(scan.id, {
          checkedSites: checked,
          foundCount: found,
          nsfwFoundCount: nsfwFound,
        });
      }

      await storage.updateOsintScan(scan.id, {
        status: scanControl.cancel ? "cancelled" : "completed",
        endTime: new Date(),
        checkedSites: checked,
        foundCount: found,
        nsfwFoundCount: nsfwFound,
      });

      activeScans.delete(scan.id);
    } catch (error: any) {
      console.error("OSINT scan error:", error?.message || error);
      try {
        await storage.updateOsintScan(scan.id, {
          status: "failed",
          endTime: new Date(),
        });
        activeScans.delete(scan.id);
      } catch {}
    }
  });

  app.post("/api/osint/scan/:id/cancel", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const control = activeScans.get(id);
      if (control) {
        control.cancel = true;
      }
      await storage.updateOsintScan(id, { status: "cancelled", endTime: new Date() });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel scan" });
    }
  });

  app.get("/api/osint/scans", async (req, res) => {
    try {
      const scans = await storage.getAllOsintScans();
      res.json(scans);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch scans" });
    }
  });

  app.get("/api/osint/scan/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const scan = await storage.getOsintScan(id);
      if (!scan) {
        return res.status(404).json({ message: "Scan not found" });
      }
      res.json(scan);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch scan" });
    }
  });

  app.get("/api/osint/scan/:id/results", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const statusFilter = req.query.status as string | undefined;
      let results;
      if (statusFilter) {
        results = await storage.getOsintResultsByStatus(id, statusFilter);
      } else {
        results = await storage.getOsintResults(id);
      }
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch results" });
    }
  });
}
