"use client";

// Session management for Guardian Angel game
// Stores game session info in localStorage

export interface GameSession {
  worldId: string;
  pookieName: string;
  deviceId: string;
  joinedAt: number;
}

const SESSION_KEY = "guardian-angel-session";
const DEVICE_ID_KEY = "guardian-angel-device-id";

/**
 * Generate a unique device ID (persists across sessions)
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 11)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Get the current game session
 */
export function getSession(): GameSession | null {
  if (typeof window === "undefined") return null;

  const sessionStr = localStorage.getItem(SESSION_KEY);
  if (!sessionStr) return null;

  try {
    return JSON.parse(sessionStr) as GameSession;
  } catch {
    return null;
  }
}

/**
 * Save a game session
 */
export function saveSession(session: GameSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Clear the current game session
 */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Check if user already has an active session for a specific world
 */
export function hasSessionForWorld(worldId: string): boolean {
  const session = getSession();
  return session?.worldId === worldId;
}

/**
 * Get session for a specific world (returns null if session is for different world)
 */
export function getSessionForWorld(worldId: string): GameSession | null {
  const session = getSession();
  if (session?.worldId === worldId) {
    return session;
  }
  return null;
}
