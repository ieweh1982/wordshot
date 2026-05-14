/**
 * Session Service - Main Process Only
 * This file should only be used in the main process.
 * All exports are stubbed for renderer compatibility.
 */

import type { LiveSession, ScriptUsageRecord } from '../types';

export interface CreateSessionInput {
  name?: string;
}

export interface SessionStats {
  sessionId: string;
  totalScriptsUsed: number;
  totalDurationMs: number;
  scriptsPerCategory: Record<string, number>;
}

// In-memory cache for sessions
const sessionsCache: LiveSession[] = [];

// Create a new live session - stubbed
export function createLiveSession(input?: CreateSessionInput): LiveSession {
  const name = input?.name || `直播-${new Date().toLocaleDateString('zh-CN')}`;
  const session: LiveSession = {
    id: crypto.randomUUID(),
    name,
    startTime: Date.now(),
    usageHistory: [],
    totalScriptsUsed: 0,
  };
  sessionsCache.push(session);
  return session;
}

// End an active live session - stubbed
export function endLiveSession(sessionId: string): LiveSession | undefined {
  const index = sessionsCache.findIndex(s => s.id === sessionId);
  if (index === -1) return undefined;
  sessionsCache[index].endTime = Date.now();
  return sessionsCache[index];
}

// Get session by ID - stubbed
export function getLiveSession(sessionId: string): LiveSession | undefined {
  return sessionsCache.find(s => s.id === sessionId);
}

// Get all sessions - stubbed
export function getAllSessions(): LiveSession[] {
  return [...sessionsCache];
}

// Get active (ongoing) sessions - stubbed
export function getActiveSessions(): LiveSession[] {
  return sessionsCache.filter(s => !s.endTime);
}

// Get completed sessions - stubbed
export function getCompletedSessions(): LiveSession[] {
  return sessionsCache.filter(s => !!s.endTime);
}

// Record script usage in a session - stubbed
export function recordScriptUsageInSession(scriptId: string, sessionId: string): void {
  const session = sessionsCache.find(s => s.id === sessionId);
  if (session) {
    session.totalScriptsUsed++;
    session.usageHistory.push({
      scriptId,
      usedAt: Date.now(),
      usedInSession: sessionId,
    });
  }
}

// Get usage history for a session - stubbed
export function getSessionUsageHistory(sessionId: string): ScriptUsageRecord[] {
  const session = sessionsCache.find(s => s.id === sessionId);
  if (!session) return [];
  return session.usageHistory.map(record => ({
    scriptId: record.scriptId,
    usedAt: record.usedAt,
    usedInSession: sessionId,
  }));
}

// Calculate session statistics - stubbed
export function getSessionStats(sessionId: string): SessionStats | null {
  const session = sessionsCache.find(s => s.id === sessionId);
  if (!session) return null;

  const scriptsPerCategory: Record<string, number> = {};
  for (const record of session.usageHistory) {
    scriptsPerCategory[record.scriptId] = (scriptsPerCategory[record.scriptId] || 0) + 1;
  }

  const totalDurationMs = session.endTime
    ? session.endTime - session.startTime
    : Date.now() - session.startTime;

  return {
    sessionId,
    totalScriptsUsed: session.usageHistory.length,
    totalDurationMs,
    scriptsPerCategory,
  };
}

// Delete a session - stubbed
export function deleteSession(sessionId: string): boolean {
  const index = sessionsCache.findIndex(s => s.id === sessionId);
  if (index === -1) return false;
  sessionsCache.splice(index, 1);
  return true;
}

// Update session name - stubbed
export function updateSessionName(sessionId: string, name: string): LiveSession | undefined {
  const session = sessionsCache.find(s => s.id === sessionId);
  if (!session) return undefined;
  session.name = name;
  return session;
}
