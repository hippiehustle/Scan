import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertScanSessionSchema, insertScanResultSchema } from "@shared/schema";
import multer from "multer";
import { classifyImage, isImageFile, loadModel, getUnsupportedResult } from "./nsfw-model";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
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

      const session = await storage.createScanSession({ userId: null });

      const results = [];
      let processedCount = 0;
      let failedCount = 0;

      for (const file of files) {
        const fileType = file.mimetype.startsWith("image/")
          ? "image"
          : file.mimetype.startsWith("video/")
            ? "video"
            : "document";

        let prediction;
        if (isImageFile(file.mimetype)) {
          try {
            if (!file.buffer || file.buffer.length === 0) {
              console.error(`Empty buffer for ${file.originalname}`);
              prediction = getUnsupportedResult();
              failedCount++;
            } else {
              console.log(`Scanning ${file.originalname} (${(file.buffer.length / 1024).toFixed(1)}KB, ${file.mimetype})`);
              prediction = await classifyImage(
                file.buffer,
                session.confidenceThreshold ?? 0.3
              );
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

        const result = await storage.createScanResult({
          sessionId: session.id,
          filename: file.originalname,
          filepath: `/uploads/${file.originalname}`,
          fileType,
          isNsfw: prediction.isNsfw,
          confidence: prediction.confidence,
          processed: prediction.supported,
          flagCategory: prediction.flagCategory,
          originalPath: `/uploads/${file.originalname}`,
          newPath: null,
          actionTaken: "none",
        });

        results.push(result);
        processedCount++;
      }

      const nsfwCount = results.filter((r) => r.isNsfw).length;

      await storage.updateScanSession(session.id, {
        totalFiles: files.length,
        processedFiles: processedCount,
        nsfwFound: nsfwCount,
        status: "completed",
        endTime: new Date(),
      });

      console.log(`Scan complete: ${files.length} files, ${nsfwCount} NSFW detected, ${failedCount} failed`);

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

  const httpServer = createServer(app);
  return httpServer;
}
