import { users, scanSessions, scanResults, type User, type InsertUser, type ScanSession, type InsertScanSession, type ScanResult, type InsertScanResult } from "@shared/schema";
import { db } from "./db";
import { eq, and, count, sum, desc } from "drizzle-orm";

export interface OrganizeOptions {
  destinationFolder: string;
  mode: "category" | "date" | "filetype" | "custom";
  filterCategories?: string[];
  filterFileTypes?: string[];
  sessionId?: number;
}

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

  organizeWithOptions(options: OrganizeOptions): Promise<{
    moved: number;
    renamed: number;
    copied: number;
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
      isProjectFile: insertResult.isProjectFile || false,
      relativePath: insertResult.relativePath || null,
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
      processed,
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

  async organizeWithOptions(options: OrganizeOptions): Promise<{ moved: number; renamed: number; copied: number; organized: ScanResult[] }> {
    let results = Array.from(this.scanResults.values()).filter(r =>
      r.isNsfw && r.actionTaken === "none"
    );

    if (options.sessionId) {
      results = results.filter(r => r.sessionId === options.sessionId);
    }
    if (options.filterCategories && options.filterCategories.length > 0) {
      results = results.filter(r => r.flagCategory && options.filterCategories!.includes(r.flagCategory));
    }
    if (options.filterFileTypes && options.filterFileTypes.length > 0) {
      results = results.filter(r => options.filterFileTypes!.includes(r.fileType));
    }

    const organized: ScanResult[] = [];
    let moved = 0;
    let renamed = 0;
    let copied = 0;

    for (const result of results) {
      const subfolder = getSubfolder(result, options.mode);
      const extension = result.filename.split('.').pop() || 'bin';
      const timestamp = new Date().toISOString().slice(0, 10);
      const newFilename = `${(result.flagCategory || 'flagged')}_${timestamp}_${result.id}.${extension}`;
      const newPath = `${options.destinationFolder}/${subfolder}/${newFilename}`;

      const action = result.isProjectFile ? "copied" : "moved";

      const updatedResult = await this.updateScanResult(result.id, {
        originalPath: result.filepath,
        newPath,
        filename: newFilename,
        actionTaken: action
      });

      if (updatedResult) {
        organized.push(updatedResult);
        if (result.isProjectFile) {
          copied++;
        } else {
          moved++;
        }
        renamed++;
      }
    }

    return { moved, renamed, copied, organized };
  }

  async clearScanHistory(): Promise<{ deleted: number }> {
    const count = this.scanResults.size + this.scanSessions.size;
    this.scanResults.clear();
    this.scanSessions.clear();
    return { deleted: count };
  }
}

function getSubfolder(result: ScanResult, mode: OrganizeOptions["mode"]): string {
  switch (mode) {
    case "category":
      return result.flagCategory || "flagged";
    case "date": {
      const dateStr = extractDateFromFilename(result.filename) || extractDateFromTimestamp(result.createdAt);
      return dateStr || "Undetermined";
    }
    case "filetype":
      return getFileTypeGroup(result.fileType, result.filename);
    case "custom":
    default:
      return result.flagCategory || "flagged";
  }
}

function extractDateFromFilename(filename: string): string | null {
  const patterns = [
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{4})(\d{2})(\d{2})/,
    /(\d{2})-(\d{2})-(\d{4})/,
    /(\d{2})\.(\d{2})\.(\d{4})/,
  ];
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      if (match[3] && match[3].length === 4) {
        return `${match[3]}-${match[2]}-${match[1]}`;
      }
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  return null;
}

function extractDateFromTimestamp(ts: Date | string | null): string | null {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function getFileTypeGroup(fileType: string, filename: string): string {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'ico', 'heic', 'heif', 'avif'];
  const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm', 'm4v', '3gp', 'mpeg', 'mpg'];
  const textExts = ['txt', 'doc', 'docx', 'pdf', 'rtf', 'odt', 'md', 'csv', 'xls', 'xlsx', 'ppt', 'pptx'];
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'dmg'];

  if (fileType === 'image' || imageExts.includes(ext)) return 'Images';
  if (fileType === 'video' || videoExts.includes(ext)) return 'Videos';
  if (fileType === 'document' || textExts.includes(ext)) return 'Documents';
  if (archiveExts.includes(ext)) return 'Archives';
  return 'Other';
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

  async organizeWithOptions(options: OrganizeOptions): Promise<{ moved: number; renamed: number; copied: number; organized: ScanResult[] }> {
    const conditions = [
      eq(scanResults.isNsfw, true),
      eq(scanResults.actionTaken, "none")
    ];

    if (options.sessionId) {
      conditions.push(eq(scanResults.sessionId, options.sessionId));
    }

    let results = await db
      .select()
      .from(scanResults)
      .where(and(...conditions));

    if (options.filterCategories && options.filterCategories.length > 0) {
      results = results.filter(r => r.flagCategory && options.filterCategories!.includes(r.flagCategory));
    }
    if (options.filterFileTypes && options.filterFileTypes.length > 0) {
      results = results.filter(r => options.filterFileTypes!.includes(r.fileType));
    }

    const organized: ScanResult[] = [];
    let moved = 0;
    let renamed = 0;
    let copied = 0;

    for (const result of results) {
      const subfolder = getSubfolder(result, options.mode);
      const extension = result.filename.split('.').pop() || 'bin';
      const timestamp = new Date().toISOString().slice(0, 10);
      const newFilename = `${(result.flagCategory || 'flagged')}_${timestamp}_${result.id}.${extension}`;
      const newPath = `${options.destinationFolder}/${subfolder}/${newFilename}`;

      const action = result.isProjectFile ? "copied" : "moved";

      const updatedResult = await this.updateScanResult(result.id, {
        originalPath: result.filepath,
        newPath,
        filename: newFilename,
        actionTaken: action
      });

      if (updatedResult) {
        organized.push(updatedResult);
        if (result.isProjectFile) {
          copied++;
        } else {
          moved++;
        }
        renamed++;
      }
    }

    return { moved, renamed, copied, organized };
  }

  async clearScanHistory(): Promise<{ deleted: number }> {
    const [resultCount] = await db.select({ count: count() }).from(scanResults);
    await db.delete(scanResults);
    await db.delete(scanSessions);
    return { deleted: resultCount?.count || 0 };
  }
}

export const storage = new DatabaseStorage();
