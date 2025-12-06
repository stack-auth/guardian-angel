"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { WorldState, PookieAction } from "./types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
const WS_URL = BACKEND_URL.replace(/^http/, "ws");

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface UseWorldStateOptions {
  worldId: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
}

export interface UseWorldStateReturn {
  worldState: WorldState | null;
  connectionStatus: ConnectionStatus;
  error: string | null;
  reconnect: () => void;
}

/**
 * Hook to connect to a world's WebSocket and receive state updates
 */
export function useWorldState({
  worldId,
  autoReconnect = true,
  reconnectDelay = 3000,
}: UseWorldStateOptions): UseWorldStateReturn {
  const [worldState, setWorldState] = useState<WorldState | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setConnectionStatus("connecting");
    setError(null);

    try {
      const ws = new WebSocket(`${WS_URL}/worlds/${worldId}/state/listen`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`[WebSocket] Connected to world: ${worldId}`);
        setConnectionStatus("connected");
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const state: WorldState = JSON.parse(event.data);
          setWorldState(state);
        } catch (err) {
          console.error("[WebSocket] Failed to parse message:", err);
        }
      };

      ws.onerror = () => {
        // Don't log the event object as it's often empty/unhelpful
        console.warn("[WebSocket] Connection error - will attempt reconnect");
        setConnectionStatus("error");
      };

      ws.onclose = (event) => {
        console.log(
          `[WebSocket] Closed. Code: ${event.code}, Reason: ${
            event.reason || "No reason provided"
          }`
        );
        setConnectionStatus("disconnected");

        // Reconnect on any abnormal close (not just error state)
        if (autoReconnect && event.code !== 1000) {
          console.log(`[WebSocket] Reconnecting in ${reconnectDelay}ms...`);
          reconnectTimeoutRef.current = setTimeout(connect, reconnectDelay);
        }
      };
    } catch (err) {
      console.error("[WebSocket] Failed to create connection:", err);
      setConnectionStatus("error");
      setError("Failed to connect to server");

      // Attempt to reconnect after delay
      if (autoReconnect) {
        reconnectTimeoutRef.current = setTimeout(connect, reconnectDelay);
      }
    }
  }, [worldId, autoReconnect, reconnectDelay]);

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    worldState,
    connectionStatus,
    error,
    reconnect,
  };
}

/**
 * Calculate the current position of a pookie based on their action
 */
export function getPookiePosition(
  action: PookieAction,
  now: number = Date.now()
): { x: number; y: number } {
  switch (action.type) {
    case "idle":
    case "thinking":
    case "interact-with-facility":
      return { x: action.x, y: action.y };

    case "move": {
      if (now <= action.startTimestampMillis) {
        return { x: action.startX, y: action.startY };
      }
      if (now >= action.endTimestampMillis) {
        return { x: action.endX, y: action.endY };
      }

      // Linear interpolation
      const progress =
        (now - action.startTimestampMillis) /
        (action.endTimestampMillis - action.startTimestampMillis);
      return {
        x: action.startX + (action.endX - action.startX) * progress,
        y: action.startY + (action.endY - action.startY) * progress,
      };
    }

    case "dead":
      return { x: action.x, y: action.y };

    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Get the facing direction of a pookie based on movement
 */
export function getPookieFacingDirection(
  action: PookieAction
): "left" | "right" {
  if (action.type === "move") {
    return action.endX > action.startX ? "right" : "left";
  }
  return "right";
}

/**
 * Check if pookie is currently moving
 */
export function isPookieMoving(
  action: PookieAction,
  now: number = Date.now()
): boolean {
  if (action.type !== "move") return false;
  return now > action.startTimestampMillis && now < action.endTimestampMillis;
}
