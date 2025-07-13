import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertScanSessionSchema, insertScanResultSchema } from "@shared/schema";
import multer from "multer";

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

  app.get("/api/scan-sessions/active", async (req, res) => {
    try {
      const sessions = await storage.getActiveScanSessions();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active sessions" });
    }
  });

  // File Upload and Analysis
  app.post("/api/upload", upload.array("files"), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      // Create a new scan session
      const session = await storage.createScanSession({ userId: null });
      
      // Process files
      const results = [];
      const flagCategories = ["explicit", "suggestive", "adult", "violent", "disturbing"];
      
      for (const file of files) {
        const confidence = Math.random(); // Simulate NSFW detection
        const isNsfw = confidence > 0.7;
        const flagCategory = isNsfw ? flagCategories[Math.floor(Math.random() * flagCategories.length)] : null;
        
        const result = await storage.createScanResult({
          sessionId: session.id,
          filename: file.originalname,
          filepath: `/uploads/${file.originalname}`,
          fileType: file.mimetype.startsWith('image/') ? 'image' : 
                   file.mimetype.startsWith('video/') ? 'video' : 'document',
          isNsfw,
          confidence,
          processed: true,
          flagCategory,
          originalPath: `/uploads/${file.originalname}`,
          newPath: null,
          actionTaken: "none",
        });
        
        results.push(result);
      }

      // Update session statistics
      await storage.updateScanSession(session.id, {
        totalFiles: files.length,
        processedFiles: files.length,
        nsfwFound: results.filter(r => r.isNsfw).length,
        status: "completed",
        endTime: new Date(),
      });

      res.json({ session, results });
    } catch (error) {
      res.status(500).json({ message: "Upload failed" });
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
