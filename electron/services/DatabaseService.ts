/**
 * Database Service - Main Process Only
 * All database operations happen here and are exposed via IPC
 */

import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database | null = null;

function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'data', 'wordshot.db');
}

export function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = getDbPath();
  const fs = require('fs');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#ffffff',
      priority INTEGER NOT NULL DEFAULT 5,
      triggers TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      usageCount INTEGER NOT NULL DEFAULT 0,
      lastUsedAt INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      theme TEXT NOT NULL,
      name TEXT NOT NULL,
      totalDurationMinutes INTEGER NOT NULL DEFAULT 60,
      patterns TEXT NOT NULL DEFAULT '[]',
      repeatCount INTEGER NOT NULL DEFAULT 1,
      freeContent TEXT NOT NULL DEFAULT '',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS segments (
      id TEXT PRIMARY KEY,
      templateId TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      durationSeconds INTEGER NOT NULL DEFAULT 300,
      "order" INTEGER NOT NULL DEFAULT 0,
      transition TEXT,
      scriptIds TEXT NOT NULL DEFAULT '[]',
      customContent TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      startTime INTEGER NOT NULL,
      endTime INTEGER,
      totalScriptsUsed INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS usage_history (
      id TEXT PRIMARY KEY,
      scriptId TEXT NOT NULL,
      usedAt INTEGER NOT NULL,
      sessionId TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_scripts (
      id TEXT PRIMARY KEY,
      originalDanmu TEXT,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      createdAt INTEGER NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS scripts_fts USING fts5(content, tags, content=scripts, content_rowid=rowid);

    CREATE TRIGGER IF NOT EXISTS scripts_ai AFTER INSERT ON scripts BEGIN
      INSERT INTO scripts_fts(rowid, content, tags) VALUES (NEW.rowid, NEW.content, NEW.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS scripts_ad AFTER DELETE ON scripts BEGIN
      INSERT INTO scripts_fts(scripts_fts, rowid, content, tags) VALUES('delete', OLD.rowid, OLD.content, OLD.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS scripts_au AFTER UPDATE ON scripts BEGIN
      INSERT INTO scripts_fts(scripts_fts, rowid, content, tags) VALUES('delete', OLD.rowid, OLD.content, OLD.tags);
      INSERT INTO scripts_fts(rowid, content, tags) VALUES (NEW.rowid, NEW.content, NEW.tags);
    END;

    CREATE INDEX IF NOT EXISTS idx_scripts_category ON scripts(category);
    CREATE INDEX IF NOT EXISTS idx_segments_templateId ON segments(templateId);
    CREATE INDEX IF NOT EXISTS idx_usage_history_scriptId ON usage_history(scriptId);
    CREATE INDEX IF NOT EXISTS idx_usage_history_sessionId ON usage_history(sessionId);
    CREATE INDEX IF NOT EXISTS idx_pending_scripts_status ON pending_scripts(status);
  `);

  // Migrate legacy tables: add freeContent/customContent columns if missing
  const templateCols = db.prepare("PRAGMA table_info(templates)").all() as any[];
  if (!templateCols.find((c: any) => c.name === 'freeContent')) {
    db.exec('ALTER TABLE templates ADD COLUMN freeContent TEXT NOT NULL DEFAULT \'\'');
  }

  const segmentCols = db.prepare("PRAGMA table_info(segments)").all() as any[];
  if (!segmentCols.find((c: any) => c.name === 'customContent')) {
    db.exec('ALTER TABLE segments ADD COLUMN customContent TEXT NOT NULL DEFAULT \'\'');
  }

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    initDatabase();
  }
  return db!;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Script operations
export function getAllScripts() {
  const database = getDatabase();
  const rows = database.prepare('SELECT * FROM scripts ORDER BY createdAt DESC').all();
  return rows.map(parseScript);
}

export function getScriptById(id: string) {
  const database = getDatabase();
  const row = database.prepare('SELECT * FROM scripts WHERE id = ?').get(id);
  return row ? parseScript(row) : undefined;
}

export function createScript(script: any) {
  const database = getDatabase();
  database.prepare(`
    INSERT INTO scripts (id, category, content, color, priority, triggers, tags, usageCount, lastUsedAt, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    script.id,
    script.category,
    script.content,
    script.color || '#ffffff',
    script.priority || 5,
    JSON.stringify(script.triggers || []),
    JSON.stringify(script.tags || []),
    script.usageCount || 0,
    script.lastUsedAt || null,
    script.createdAt || Date.now(),
    script.updatedAt || Date.now()
  );
  return script;
}

export function updateScript(id: string, updates: any) {
  const database = getDatabase();
  const existing = database.prepare('SELECT * FROM scripts WHERE id = ?').get(id);
  if (!existing) return undefined;

  const updated = { ...existing, ...updates };
  database.prepare(`
    UPDATE scripts SET category = ?, content = ?, color = ?, priority = ?, triggers = ?, tags = ?, usageCount = ?, lastUsedAt = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    updated.category,
    updated.content,
    updated.color,
    updated.priority,
    JSON.stringify(updated.triggers || []),
    JSON.stringify(updated.tags || []),
    updated.usageCount,
    updated.lastUsedAt,
    Date.now(),
    id
  );
  return parseScript(updated);
}

export function deleteScript(id: string) {
  const database = getDatabase();
  const result = database.prepare('DELETE FROM scripts WHERE id = ?').run(id);
  return result.changes > 0;
}

export function searchScripts(query: string) {
  const database = getDatabase();
  const rows = database.prepare(`
    SELECT scripts.* FROM scripts
    JOIN scripts_fts ON scripts.rowid = scripts_fts.rowid
    WHERE scripts_fts MATCH ?
    ORDER BY rank
  `).all(query);
  return rows.map(parseScript);
}

function parseScript(row: any) {
  const parseJSON = (val: any) => {
    if (val == null || val === '') return [];
    try { return JSON.parse(val); } catch { return []; }
  };
  return {
    ...row,
    triggers: parseJSON(row.triggers),
    tags: parseJSON(row.tags),
  };
}

// Template operations
export function getAllTemplates() {
  const database = getDatabase();
  const rows = database.prepare('SELECT * FROM templates ORDER BY createdAt DESC').all();
  // Fetch segments for each template
  return rows.map((row: any) => {
    const segments = database.prepare('SELECT * FROM segments WHERE templateId = ? ORDER BY "order" ASC').all(row.id);
    return {
      ...row,
      freeContent: row.freeContent || '',
      segments: segments.map((s: any) => ({
        ...s,
        scriptIds: s.scriptIds ? JSON.parse(s.scriptIds) : [],
        customContent: s.customContent || '',
      })),
    };
  });
}

export function getTemplateById(id: string) {
  const database = getDatabase();
  const row: any = database.prepare('SELECT * FROM templates WHERE id = ?').get(id);
  if (!row) return undefined;
  const segments = database.prepare('SELECT * FROM segments WHERE templateId = ? ORDER BY "order" ASC').all(id);
  return {
    ...row,
    freeContent: row.freeContent || '',
    segments: segments.map((s: any) => ({
      ...s,
      scriptIds: s.scriptIds ? JSON.parse(s.scriptIds) : [],
      customContent: s.customContent || '',
    })),
  };
}

export function createTemplate(template: any) {
  const database = getDatabase();
  database.prepare(`
    INSERT INTO templates (id, theme, name, totalDurationMinutes, patterns, repeatCount, freeContent, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    template.id,
    template.theme,
    template.name,
    template.totalDurationMinutes || 60,
    JSON.stringify(template.patterns || []),
    template.repeatCount || 1,
    template.freeContent || '',
    template.createdAt || Date.now(),
    template.updatedAt || Date.now()
  );
  return template;
}

export function updateTemplate(id: string, updates: any) {
  const database = getDatabase();
  const existing = database.prepare('SELECT * FROM templates WHERE id = ?').get(id);
  if (!existing) return undefined;

  const updated = { ...existing, ...updates };
  database.prepare(`
    UPDATE templates SET theme = ?, name = ?, totalDurationMinutes = ?, patterns = ?, repeatCount = ?, freeContent = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    updated.theme,
    updated.name,
    updated.totalDurationMinutes,
    JSON.stringify(updated.patterns || []),
    updated.repeatCount || 1,
    updated.freeContent || '',
    Date.now(),
    id
  );
  return updated;
}

export function deleteTemplate(id: string) {
  console.log('[DatabaseService] deleteTemplate called with id:', id);
  const database = getDatabase();
  // Delete associated segments first
  database.prepare('DELETE FROM segments WHERE templateId = ?').run(id);
  const result = database.prepare('DELETE FROM templates WHERE id = ?').run(id);
  console.log('[DatabaseService] deleteTemplate result:', result.changes > 0);
  return result.changes > 0;
}

// Segment operations
export function getSegmentsByTemplate(templateId: string) {
  const database = getDatabase();
  const rows = database.prepare('SELECT * FROM segments WHERE templateId = ? ORDER BY "order" ASC').all(templateId);
  return rows;
}

export function createSegment(segment: any) {
  const database = getDatabase();
  database.prepare(`
    INSERT INTO segments (id, templateId, name, category, durationSeconds, "order", transition, scriptIds, customContent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    segment.id,
    segment.templateId,
    segment.name,
    segment.category,
    segment.durationSeconds || 300,
    segment.order || 0,
    segment.transition || null,
    JSON.stringify(segment.scriptIds || []),
    segment.customContent || ''
  );
  return segment;
}

export function updateSegment(id: string, updates: any) {
  const database = getDatabase();
  const existing = database.prepare('SELECT * FROM segments WHERE id = ?').get(id);
  if (!existing) return undefined;

  const updated = { ...existing, ...updates };
  database.prepare(`
    UPDATE segments SET name = ?, category = ?, durationSeconds = ?, "order" = ?, transition = ?, scriptIds = ?, customContent = ?
    WHERE id = ?
  `).run(
    updated.name,
    updated.category,
    updated.durationSeconds,
    updated.order,
    updated.transition || null,
    JSON.stringify(updated.scriptIds || []),
    updated.customContent || '',
    id
  );
  return updated;
}

export function deleteSegment(id: string) {
  const database = getDatabase();
  const result = database.prepare('DELETE FROM segments WHERE id = ?').run(id);
  return result.changes > 0;
}

// Clear all scripts from database
export function clearAllScripts() {
  const database = getDatabase();
  const result = database.prepare('DELETE FROM scripts').run();
  return { success: true, deletedCount: result.changes };
}
