import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const scanSessions = pgTable("scan_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  status: text("status").notNull().default("active"), // 'active', 'completed', 'paused', 'failed'
  totalFiles: integer("total_files").default(0),
  processedFiles: integer("processed_files").default(0),
  nsfwFound: integer("nsfw_found").default(0),
  scanType: text("scan_type").notNull().default("full"), // 'full', 'quick', 'custom', 'scheduled'
  targetFolders: text("target_folders").array().default([]),
  fileTypes: text("file_types").array().default(["image", "video", "document"]),
  confidenceThreshold: real("confidence_threshold").default(0.7),
  autoActions: text("auto_actions").array().default([]), // 'move', 'rename', 'backup', 'delete'
  customSettings: text("custom_settings"), // JSON string for additional settings
});

export const scanResults = pgTable("scan_results", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => scanSessions.id).notNull(),
  filename: text("filename").notNull(),
  filepath: text("filepath").notNull(),
  fileType: text("file_type").notNull(), // 'image', 'video', 'document'
  isNsfw: boolean("is_nsfw").notNull().default(false),
  confidence: real("confidence").notNull().default(0),
  processed: boolean("processed").notNull().default(false),
  flagCategory: text("flag_category"), // 'explicit', 'suggestive', 'adult', 'violent', 'disturbing'
  originalPath: text("original_path"),
  newPath: text("new_path"),
  actionTaken: text("action_taken"), // 'none', 'moved', 'renamed', 'backed_up', 'deleted'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertScanSessionSchema = createInsertSchema(scanSessions).omit({
  id: true,
  startTime: true,
});

export const insertScanResultSchema = createInsertSchema(scanResults).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ScanSession = typeof scanSessions.$inferSelect;
export type InsertScanSession = z.infer<typeof insertScanSessionSchema>;
export type ScanResult = typeof scanResults.$inferSelect;
export type InsertScanResult = z.infer<typeof insertScanResultSchema>;
