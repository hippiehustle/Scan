import { users, scanSessions, scanResults, type User, type InsertUser, type ScanSession, type InsertScanSession, type ScanResult, type InsertScanResult } from "@shared/schema";
import { db } from "./db";
import { eq, and, count, sum, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createScanSession(session: InsertScanSession): Promise<ScanSession>;
  getScanSession(id: number): Promise<ScanSession | undefined>;
  updateScanSession(id: number, updates: Partial<ScanSession>): Promise<ScanSession | undefined>;
  getActiveScanSessions(): Promise<ScanSession[]>;
  getAllScanSessions(): Promise<ScanSession[]>;
  
  createScanResult(result: InsertScanResult): Promise<ScanResult>;
  getScanResults(sessionId: number): Promise<ScanResult[]>;
  getAllResults(): Promise<ScanResult[]>;
  getNsfwResults(sessionId?: number): Promise<ScanResult[]>;
  updateScanResult(id: number, updates: Partial<ScanResult>): Promise<ScanResult | undefined>;
  
  getStats(): Promise<{
    totalFiles: number;
    nsfwFound: number;
    processed: number;
  }>;
  
  organizeFiles(sessionId: number): Promise<{
    moved: number;
    renamed: number;
    organized: ScanResult[];
  }>;

  organizeAllNsfwFiles(): Promise<{
    moved: number;
    renamed: number;
    organized: ScanResult[];
  }>;

  clearScanHistory(): Promise<{ deleted: number }>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private scanSessions: Map<number, ScanSession>;
  private scanResults: Map<number, ScanResult>;
  private currentUserId: number;
  private currentSessionId: number;
  private currentResultId: number;

  constructor() {
    this.users = new Map();
    this.scanSessions = new Map();
    this.scanResults = new Map();
    this.currentUserId = 1;
    this.currentSessionId = 1;
    this.currentResultId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createScanSession(insertSession: InsertScanSession): Promise<ScanSession> {
    const id = this.currentSessionId++;
    const session: ScanSession = {
      id,
      userId: insertSession.userId || null,
      startTime: new Date(),
      endTime: null,
      status: "active",
      totalFiles: 0,
      processedFiles: 0,
      nsfwFound: 0,
      scanType: insertSession.scanType || "full",
      targetFolders: insertSession.targetFolders || [],
      fileTypes: insertSession.fileTypes || ["image", "video", "document"],
      confidenceThreshold: insertSession.confidenceThreshold || 0.3,
      autoActions: insertSession.autoActions || [],
      customSettings: insertSession.customSettings || null,
    };
    this.scanSessions.set(id, session);
    return session;
  }

  async getScanSession(id: number): Promise<ScanSession | undefined> {
    return this.scanSessions.get(id);
  }

  async updateScanSession(id: number, updates: Partial<ScanSession>): Promise<ScanSession | undefined> {
    const session = this.scanSessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates };
    this.scanSessions.set(id, updatedSession);
    return updatedSession;
  }

  async getActiveScanSessions(): Promise<ScanSession[]> {
    return Array.from(this.scanSessions.values()).filter(s => s.status === "active");
  }

  async getAllScanSessions(): Promise<ScanSession[]> {
    return Array.from(this.scanSessions.values());
  }

  async createScanResult(insertResult: InsertScanResult): Promise<ScanResult> {
    const id = this.currentResultId++;
    const result: ScanResult = {
      id,
      sessionId: insertResult.sessionId,
      filename: insertResult.filename,
      filepath: insertResult.filepath,
      fileType: insertResult.fileType,
      isNsfw: insertResult.isNsfw || false,
      confidence: insertResult.confidence || 0,
      processed: insertResult.processed || false,
      flagCategory: insertResult.flagCategory || null,
      originalPath: insertResult.originalPath || null,
      newPath: insertResult.newPath || null,
      actionTaken: insertResult.actionTaken || "none",
      createdAt: new Date(),
    };
    this.scanResults.set(id, result);
    return result;
  }

  async getScanResults(sessionId: number): Promise<ScanResult[]> {
    return Array.from(this.scanResults.values()).filter(r => r.sessionId === sessionId);
  }

  async getAllResults(): Promise<ScanResult[]> {
    return Array.from(this.scanResults.values());
  }

  async getNsfwResults(sessionId?: number): Promise<ScanResult[]> {
    const results = Array.from(this.scanResults.values()).filter(r => r.isNsfw);
    if (sessionId) {
      return results.filter(r => r.sessionId === sessionId);
    }
    return results;
  }

  async updateScanResult(id: number, updates: Partial<ScanResult>): Promise<ScanResult | undefined> {
    const result = this.scanResults.get(id);
    if (!result) return undefined;
    
    const updatedResult = { ...result, ...updates };
    this.scanResults.set(id, updatedResult);
    return updatedResult;
  }

  async getStats(): Promise<{ totalFiles: number; nsfwFound: number; processed: number }> {
    const allResults = Array.from(this.scanResults.values());
    const totalFiles = allResults.length;
    const nsfwFound = allResults.filter(r => r.isNsfw).length;
    const processed = allResults.filter(r => r.processed).length;
    
    return {
      totalFiles,
      nsfwFound,
      processed: totalFiles > 0 ? Math.round((processed / totalFiles) * 100) : 0,
    };
  }

  async organizeFiles(sessionId: number): Promise<{ moved: number; renamed: number; organized: ScanResult[] }> {
    const sessionResults = Array.from(this.scanResults.values()).filter(r => 
      r.sessionId === sessionId && r.isNsfw && r.actionTaken === "none"
    );
    
    const organized: ScanResult[] = [];
    let moved = 0;
    let renamed = 0;

    for (const result of sessionResults) {
      const category = result.flagCategory || "flagged";
      const timestamp = new Date().toISOString().slice(0, 10);
      const extension = result.filename.split('.').pop();
      const newFilename = `${category}_${timestamp}_${result.id}.${extension}`;
      const newPath = `/SecureScanner/${category}/${newFilename}`;
      
      const updatedResult = await this.updateScanResult(result.id, {
        originalPath: result.filepath,
        newPath: newPath,
        filename: newFilename,
        actionTaken: "moved"
      });
      
      if (updatedResult) {
        organized.push(updatedResult);
        moved++;
        renamed++;
      }
    }

    return { moved, renamed, organized };
  }

  async organizeAllNsfwFiles(): Promise<{ moved: number; renamed: number; organized: ScanResult[] }> {
    const nsfwResults = Array.from(this.scanResults.values()).filter(r => 
      r.isNsfw && r.actionTaken === "none"
    );
    
    const organized: ScanResult[] = [];
    let moved = 0;
    let renamed = 0;

    for (const result of nsfwResults) {
      const category = result.flagCategory || "flagged";
      const timestamp = new Date().toISOString().slice(0, 10);
      const extension = result.filename.split('.').pop();
      const newFilename = `${category}_${timestamp}_${result.id}.${extension}`;
      const newPath = `/SecureScanner/${category}/${newFilename}`;
      
      const updatedResult = await this.updateScanResult(result.id, {
        originalPath: result.filepath,
        newPath: newPath,
        filename: newFilename,
        actionTaken: "moved"
      });
      
      if (updatedResult) {
        organized.push(updatedResult);
        moved++;
        renamed++;
      }
    }

    return { moved, renamed, organized };
  }

  async clearScanHistory(): Promise<{ deleted: number }> {
    const count = this.scanResults.size + this.scanSessions.size;
    this.scanResults.clear();
    this.scanSessions.clear();
    return { deleted: count };
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createScanSession(insertSession: InsertScanSession): Promise<ScanSession> {
    const [session] = await db
      .insert(scanSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async getScanSession(id: number): Promise<ScanSession | undefined> {
    const [session] = await db.select().from(scanSessions).where(eq(scanSessions.id, id));
    return session || undefined;
  }

  async updateScanSession(id: number, updates: Partial<ScanSession>): Promise<ScanSession | undefined> {
    const [session] = await db
      .update(scanSessions)
      .set(updates)
      .where(eq(scanSessions.id, id))
      .returning();
    return session || undefined;
  }

  async getActiveScanSessions(): Promise<ScanSession[]> {
    return await db.select().from(scanSessions).where(eq(scanSessions.status, "active"));
  }

  async getAllScanSessions(): Promise<ScanSession[]> {
    return await db.select().from(scanSessions).orderBy(desc(scanSessions.startTime));
  }

  async createScanResult(insertResult: InsertScanResult): Promise<ScanResult> {
    const [result] = await db
      .insert(scanResults)
      .values(insertResult)
      .returning();
    return result;
  }

  async getScanResults(sessionId: number): Promise<ScanResult[]> {
    return await db.select().from(scanResults).where(eq(scanResults.sessionId, sessionId));
  }

  async getAllResults(): Promise<ScanResult[]> {
    return await db.select().from(scanResults).orderBy(desc(scanResults.createdAt));
  }

  async getNsfwResults(sessionId?: number): Promise<ScanResult[]> {
    const conditions = [eq(scanResults.isNsfw, true)];
    if (sessionId) {
      conditions.push(eq(scanResults.sessionId, sessionId));
    }
    
    return await db
      .select()
      .from(scanResults)
      .where(and(...conditions))
      .orderBy(desc(scanResults.createdAt));
  }

  async updateScanResult(id: number, updates: Partial<ScanResult>): Promise<ScanResult | undefined> {
    const [result] = await db
      .update(scanResults)
      .set(updates)
      .where(eq(scanResults.id, id))
      .returning();
    return result || undefined;
  }

  async getStats(): Promise<{ totalFiles: number; nsfwFound: number; processed: number }> {
    const [totalFilesResult] = await db
      .select({ count: count() })
      .from(scanResults);
    
    const [nsfwResult] = await db
      .select({ count: count() })
      .from(scanResults)
      .where(eq(scanResults.isNsfw, true));
    
    const [processedResult] = await db
      .select({ count: count() })
      .from(scanResults)
      .where(eq(scanResults.processed, true));

    return {
      totalFiles: totalFilesResult?.count || 0,
      nsfwFound: nsfwResult?.count || 0,
      processed: processedResult?.count || 0,
    };
  }

  async organizeFiles(sessionId: number): Promise<{ moved: number; renamed: number; organized: ScanResult[] }> {
    const sessionResults = await db
      .select()
      .from(scanResults)
      .where(
        and(
          eq(scanResults.sessionId, sessionId),
          eq(scanResults.isNsfw, true),
          eq(scanResults.actionTaken, "none")
        )
      );
    
    const organized: ScanResult[] = [];
    let moved = 0;
    let renamed = 0;

    for (const result of sessionResults) {
      // Simulate file organization
      const category = result.flagCategory || "flagged";
      const timestamp = new Date().toISOString().slice(0, 10);
      const extension = result.filename.split('.').pop();
      const newFilename = `${category}_${timestamp}_${result.id}.${extension}`;
      const newPath = `/SecureScanner/${category}/${newFilename}`;
      
      const updatedResult = await this.updateScanResult(result.id, {
        originalPath: result.filepath,
        newPath: newPath,
        filename: newFilename,
        actionTaken: "moved"
      });
      
      if (updatedResult) {
        organized.push(updatedResult);
        moved++;
        renamed++;
      }
    }

    return {
      moved,
      renamed,
      organized
    };
  }

  async organizeAllNsfwFiles(): Promise<{ moved: number; renamed: number; organized: ScanResult[] }> {
    const nsfwResults = await db
      .select()
      .from(scanResults)
      .where(
        and(
          eq(scanResults.isNsfw, true),
          eq(scanResults.actionTaken, "none")
        )
      );
    
    const organized: ScanResult[] = [];
    let moved = 0;
    let renamed = 0;

    for (const result of nsfwResults) {
      const category = result.flagCategory || "flagged";
      const timestamp = new Date().toISOString().slice(0, 10);
      const extension = result.filename.split('.').pop();
      const newFilename = `${category}_${timestamp}_${result.id}.${extension}`;
      const newPath = `/SecureScanner/${category}/${newFilename}`;
      
      const updatedResult = await this.updateScanResult(result.id, {
        originalPath: result.filepath,
        newPath: newPath,
        filename: newFilename,
        actionTaken: "moved"
      });
      
      if (updatedResult) {
        organized.push(updatedResult);
        moved++;
        renamed++;
      }
    }

    return { moved, renamed, organized };
  }

  async clearScanHistory(): Promise<{ deleted: number }> {
    const [resultCount] = await db.select({ count: count() }).from(scanResults);
    await db.delete(scanResults);
    await db.delete(scanSessions);
    return { deleted: resultCount?.count || 0 };
  }
}

export const storage = new DatabaseStorage();
