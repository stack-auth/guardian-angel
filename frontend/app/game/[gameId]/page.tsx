"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useWorldState,
  getPookiePosition,
  getPookieFacingDirection,
  isPookieMoving,
} from "../../useWorldState";
import type { Pookie, PookieThought, WorldState } from "../../types";
import { PixelButton } from "../../components/PixelButton";
import { QRCodeDialog } from "../../components/QRCodeDialog";
import { SystemPromptDialog } from "../../components/SystemPromptDialog";
import { PookieSidebar } from "../../components/PookieSidebar";
import {
  getSessionForWorld,
  saveSession,
  clearSession,
  getDeviceId,
} from "../../lib/session";
import { getBackendUrl, DEFAULT_LEVEL } from "../../lib/gameConfig";
import { getShareableGameUrl } from "../../lib/urlUtils";

// Color palette for pookies
const POOKIE_COLORS = [
  { base: "#60a5fa", light: "#93c5fd", dark: "#2563eb", darker: "#1e40af", border: "#1e3a8a" },
  { base: "#f87171", light: "#fca5a5", dark: "#dc2626", darker: "#b91c1c", border: "#7f1d1d" },
  { base: "#4ade80", light: "#86efac", dark: "#16a34a", darker: "#15803d", border: "#14532d" },
  { base: "#facc15", light: "#fde047", dark: "#ca8a04", darker: "#a16207", border: "#713f12" },
  { base: "#c084fc", light: "#d8b4fe", dark: "#9333ea", darker: "#7e22ce", border: "#581c87" },
  { base: "#fb923c", light: "#fdba74", dark: "#ea580c", darker: "#c2410c", border: "#7c2d12" },
  { base: "#2dd4bf", light: "#5eead4", dark: "#0d9488", darker: "#0f766e", border: "#134e4a" },
  { base: "#f472b6", light: "#f9a8d4", dark: "#db2777", darker: "#be185d", border: "#831843" },
  { base: "#a78bfa", light: "#c4b5fd", dark: "#7c3aed", darker: "#6d28d9", border: "#4c1d95" },
  { base: "#38bdf8", light: "#7dd3fc", dark: "#0284c7", darker: "#0369a1", border: "#075985" },
];

function getPookieColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % POOKIE_COLORS.length;
}

function ThoughtBubble({ message }: { message: string }) {
  return (
    <div className="thought-bubble">
      {message}
    </div>
  );
}

function getThoughtText(thought: PookieThought): string {
  switch (thought.source) {
    case "self":
      return thought.text;
    case "guardian-angel":
      return `🪽 ${thought.text}`;
    case "facility":
      return `📍 ${thought.text}`;
    case "self-action-change":
      return thought.text;
    case "someone-else-said":
      return `${thought.sayerPookieName}: ${thought.text}`;
    case "trade-offer-received":
      return `📦 ${thought.fromPookieName} offers: ${thought.itemsOffered.map(i => `${i.amount}x ${i.itemId}`).join(', ')} for ${thought.itemsRequested.map(i => `${i.amount}x ${i.itemId}`).join(', ')}`;
    case "trade-completed":
      return `✅ Trade with ${thought.withPookieName}: gave ${thought.itemsGiven.map(i => `${i.amount}x ${i.itemId}`).join(', ')}, got ${thought.itemsReceived.map(i => `${i.amount}x ${i.itemId}`).join(', ')}`;
    case "trade-rejected":
      return `❌ ${thought.byPookieName} rejected your trade`;
    default:
      return "";
  }
}

interface PookieSpriteProps {
  pookie: Pookie;
  name: string;
  levelWidth: number;
  levelHeight: number;
  isOwn: boolean;
  debugMode: boolean;
  speechDistancePercent: number;
  onClick?: () => void;
}

function PookieSprite({ pookie, name, levelWidth, levelHeight, isOwn, debugMode, speechDistancePercent, onClick }: PookieSpriteProps) {
  const [position, setPosition] = useState(() => getPookiePosition(pookie.currentAction));
  const animationFrameRef = useRef<number | null>(null);

  const color = POOKIE_COLORS[getPookieColorIndex(name)];

  // Only show thoughts that are spoken loudly (source: "self" with spokenLoudly: true)
  const latestSpokenThought = [...pookie.thoughts]
    .reverse()
    .find((t): t is Extract<PookieThought, { source: "self" }> => t.source === "self" && t.spokenLoudly) || null;
  const showThought = latestSpokenThought && Date.now() - latestSpokenThought.timestampMillis < 5000;

  useEffect(() => {
    let isActive = true;

    const animate = () => {
      if (!isActive) return;

      const now = Date.now();
      const newPosition = getPookiePosition(pookie.currentAction, now);
      setPosition(newPosition);

      const shouldKeepAnimating =
        pookie.currentAction.type === "move" &&
        now < pookie.currentAction.endTimestampMillis;

      if (shouldKeepAnimating) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animate();

    return () => {
      isActive = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [pookie.currentAction]);

  const now = Date.now();
  const isMoving = isPookieMoving(pookie.currentAction, now);
  const isThinking = pookie.currentAction.type === "thinking";
  const isDead = pookie.currentAction.type === "dead";
  const isInteracting = pookie.currentAction.type === "interact-with-facility";
  const facingDirection = getPookieFacingDirection(pookie.currentAction);
  const facingLeft = facingDirection === "left";
  
  // Check if recently got hit (within last 500ms)
  const recentHit = pookie.thoughts.find(
    t => t.source === "got-hit" && now - t.timestampMillis < 500
  );
  const isHit = !!recentHit;
  
  // Check if recently attacked (within last 300ms)
  const recentAttack = pookie.thoughts.find(
    t => t.source === "hit-someone" && now - t.timestampMillis < 300
  );
  const isAttacking = !!recentAttack;
  
  // For dead pookies, check if still in death animation
  const isDying = isDead && pookie.currentAction.type === "dead" && 
    now - pookie.currentAction.sinceTimestampMillis < 500;

  // Convert world units to percentages for responsive positioning
  const percentX = (position.x / levelWidth) * 100;
  const percentY = (position.y / levelHeight) * 100;

  return (
    <div
      className={`absolute pixel-art ${onClick ? "cursor-pointer" : ""}`}
      style={{
        left: `${percentX}%`,
        top: `${percentY}%`,
        transform: "translate(-50%, -50%)",
        opacity: isDead ? 0.5 : 1,
        zIndex: Math.floor(percentY * 100),
      }}
      onClick={onClick}
    >
      {/* Debug: Speech distance circle - use percentage-based sizing */}
      {debugMode && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: `${speechDistancePercent * 2}vmin`,
            height: `${speechDistancePercent * 2}vmin`,
            left: `${-speechDistancePercent}vmin`,
            top: `${-speechDistancePercent}vmin`,
            border: `2px dashed ${color.base}80`,
            backgroundColor: `${color.base}10`,
          }}
        />
      )}

      {/* Glow/Halo effect for own pookie */}
      {isOwn && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none animate-pulse-glow"
          style={{
            width: "60px",
            height: "60px",
            background: `radial-gradient(circle, ${color.light}40 0%, ${color.base}20 40%, transparent 70%)`,
            filter: "blur(4px)",
          }}
        />
      )}

      {/* Pookie Name */}
      <div
        className="absolute left-1/2 text-xs font-bold text-white whitespace-nowrap"
        style={{
          transform: "translateX(-50%)",
          textShadow: "1px 1px 2px black, -1px -1px 2px black",
          top: "-20px",
        }}
      >
        {isOwn && <span className="text-emerald-400">🪽 </span>}
        {name}
      </div>

      {/* Health/Food bars - hidden when dead */}
      {!isDead && (
        <div
          className="absolute left-1/2 flex flex-col gap-0.5"
          style={{
            transform: "translateX(-50%)",
            top: "48px",
          }}
        >
          <div className="w-6 h-1 bg-gray-700 rounded-sm overflow-hidden">
            <div 
              className="h-full transition-all" 
              style={{ 
                width: `${pookie.health}%`,
                backgroundColor: pookie.health < 30 ? "#ef4444" : pookie.health < 60 ? "#f59e0b" : "#22c55e",
              }} 
            />
          </div>
          <div className="w-6 h-1 bg-gray-700 rounded-sm overflow-hidden">
            <div className="h-full bg-yellow-500" style={{ width: `${pookie.food}%` }} />
          </div>
        </div>
      )}

      {/* Debug info */}
      {debugMode && (
        <div
          className="absolute left-1/2 -translate-x-1/2 text-white bg-black/70 px-1 rounded whitespace-nowrap"
          style={{
            top: "70px",
            fontSize: "8px",
          }}
        >
          {pookie.currentAction.type} | HP:{pookie.health} | F:{pookie.food}
        </div>
      )}

      {/* Character body */}
      <div
        className={`relative ${isMoving ? "animate-moving" : ""} ${isThinking ? "animate-talking" : ""} ${isInteracting ? "animate-interacting" : ""} ${isDying ? "animate-dying" : ""} ${isDead && !isDying ? "animate-dead" : ""} ${isHit ? "animate-hit" : ""} ${isAttacking ? "animate-attacking" : ""}`}
        style={{ transform: facingLeft ? "scaleX(-1)" : "scaleX(1)" }}
      >
        {/* Shadow - smaller/different when dead */}
        <div 
          className={`absolute left-1/2 top-full -translate-x-1/2 translate-y-0.5 bg-black/40 pixel-shadow transition-all`}
          style={{
            width: isDead ? "8px" : "12px",
            height: isDead ? "4px" : "2px",
            borderRadius: isDead ? "50%" : "1px",
          }}
        />

        {/* Ghost rising from dead pookie */}
        {isDead && !isDying && (
          <div 
            className="absolute left-1/2 -translate-x-1/2 dead-ghost pointer-events-none"
            style={{ top: "-24px" }}
          >
            <span className="text-lg opacity-50">👻</span>
          </div>
        )}

        {/* Speech Bubble - only shown for spoken loudly thoughts */}
        {showThought && latestSpokenThought && !isDead && (
          <div
            className="absolute bottom-full left-1/2 mb-6"
            style={{ transform: `translateX(-50%) ${facingLeft ? "scaleX(-1)" : "scaleX(1)"}` }}
          >
            <ThoughtBubble message={latestSpokenThought.text} />
          </div>
        )}

        {/* Thinking indicator */}
        {isThinking && (
          <div
            className="absolute left-1/2 text-lg"
            style={{
              transform: `translateX(-50%) ${facingLeft ? "scaleX(-1)" : "scaleX(1)"}`,
              top: "-28px",
            }}
          >
            💭
          </div>
        )}

        {/* Interacting with facility indicator */}
        {isInteracting && (
          <div
            className="absolute left-1/2 text-lg"
            style={{
              transform: `translateX(-50%) ${facingLeft ? "scaleX(-1)" : "scaleX(1)"}`,
              top: "-28px",
              animation: "interactBob 0.6s ease-in-out infinite",
            }}
          >
            ⚒️
          </div>
        )}

        {/* Dead indicator - skull */}
        {isDead && (
          <div
            className="absolute left-1/2 text-sm"
            style={{
              transform: `translateX(-50%) ${facingLeft ? "scaleX(-1)" : "scaleX(1)"}`,
              top: "-20px",
            }}
          >
            💀
          </div>
        )}

        {/* Hit damage indicator */}
        {isHit && recentHit && recentHit.source === "got-hit" && (
          <div
            className="absolute left-1/2 text-xs font-bold"
            style={{
              transform: "translateX(-50%)",
              top: "-32px",
              color: "#ef4444",
              textShadow: "1px 1px 0 #000, -1px -1px 0 #000",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            -{recentHit.damage}
          </div>
        )}

        {/* Head */}
        <div
          className="w-4 h-4 relative z-10 pixel-head"
          style={{
            backgroundColor: isDead ? "#9ca3af" : color.base,
            border: `1px solid ${isDead ? "#6b7280" : color.border}`,
            borderRadius: "1px",
          }}
        >
          <div className="absolute top-0 left-0 w-2.5 h-1.5" style={{ backgroundColor: isDead ? "#d1d5db" : color.light, borderRadius: "0" }} />
          <div className="absolute bottom-0 left-0 w-full h-0.5" style={{ backgroundColor: isDead ? "#6b7280" : color.dark, borderRadius: "0" }} />
          {/* Eyes - X's when dead */}
          {isDead ? (
            <>
              <div className="absolute left-0.5 top-1 w-1 h-1 text-[6px] leading-none" style={{ color: color.border }}>✕</div>
              <div className="absolute right-0.5 top-1 w-1 h-1 text-[6px] leading-none" style={{ color: color.border }}>✕</div>
            </>
          ) : (
            <>
              <div className="absolute left-0.5 top-1 w-1 h-1 bg-white" style={{ border: `0.5px solid ${color.border}`, borderRadius: "0" }} />
              <div className="absolute right-0.5 top-1 w-1 h-1 bg-white" style={{ border: `0.5px solid ${color.border}`, borderRadius: "0" }} />
            </>
          )}
        </div>

        {/* Body */}
        <div
          className="absolute left-1/2 top-4 -translate-x-1/2 w-4 h-4 pixel-body"
          style={{
            backgroundColor: isDead ? "#6b7280" : color.dark,
            border: `1px solid ${isDead ? "#4b5563" : color.border}`,
            borderRadius: "1px 1px 0 0",
          }}
        >
          <div className="absolute top-0 left-0 w-2.5 h-1.5" style={{ backgroundColor: isDead ? "#9ca3af" : color.base, borderRadius: "0" }} />
          <div className="absolute bottom-0 left-0 w-full h-0.5" style={{ backgroundColor: isDead ? "#4b5563" : color.darker, borderRadius: "0" }} />
          <div className="absolute top-0 right-0 w-0.5 h-full" style={{ backgroundColor: isDead ? "#4b5563" : color.darker, borderRadius: "0" }} />
        </div>

        {/* Legs */}
        <div className="absolute left-1/2 top-8 -translate-x-1/2 flex gap-0.5 pixel-legs">
          <div
            className="w-1.5 h-2.5 pixel-leg-left"
            style={{
              backgroundColor: isDead ? "#6b7280" : color.dark,
              border: `1px solid ${isDead ? "#4b5563" : color.border}`,
              borderRadius: "0 0 1px 1px",
            }}
          >
            <div className="absolute bottom-0 left-0 w-full h-0.5" style={{ backgroundColor: isDead ? "#4b5563" : color.darker, borderRadius: "0" }} />
          </div>
          <div
            className="w-1.5 h-2.5 pixel-leg-right"
            style={{
              backgroundColor: isDead ? "#6b7280" : color.dark,
              border: `1px solid ${isDead ? "#4b5563" : color.border}`,
              borderRadius: "0 0 1px 1px",
            }}
          >
            <div className="absolute bottom-0 left-0 w-full h-0.5" style={{ backgroundColor: isDead ? "#4b5563" : color.darker, borderRadius: "0" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Debug panel component
function DebugPanel({
  isOpen,
  worldState,
  connectionStatus
}: {
  isOpen: boolean;
  worldState: WorldState | null;
  connectionStatus: string;
}) {
  if (!isOpen) return null;

  const pookieCount = worldState ? Object.keys(worldState.pookies).length : 0;
  const facilityCount = worldState ? Object.keys(worldState.level.facilities).length : 0;

  return (
    <div 
      className="absolute top-12 right-2 z-40 p-2 text-xs max-w-64 max-h-80 overflow-auto scrollbar-thin"
      style={{
        background: "linear-gradient(180deg, #f7edd5 0%, #ebd9b4 100%)",
        border: "3px solid #8b5e34",
        borderRadius: "4px",
        boxShadow: "3px 3px 0 #5c3d1e",
        color: "#3d2814",
      }}
    >
      <div className="font-bold mb-1" style={{ color: "#4a8c59" }}>Debug Info</div>
      <div className="space-y-1" style={{ color: "#5c4a32" }}>
        <div>Connection: <span style={{ color: connectionStatus === "connected" ? "#16a34a" : "#d97706" }}>{connectionStatus}</span></div>
        <div>Pookies: {pookieCount}</div>
        <div>Facilities: {facilityCount}</div>
        {worldState && (
          <>
            <div>Speech Distance: {worldState.level.speechDistance} units</div>
            <div>Facility Distance: {worldState.level.facilityInteractionDistance} units</div>
            <div>Map Size: {worldState.level.width}x{worldState.level.height}</div>
            <div className="mt-1 pt-1" style={{ borderTop: "1px solid #a67c52" }}>
              <div style={{ color: "#d4914d" }}>Pookie States:</div>
              {Object.entries(worldState.pookies).map(([name, p]) => (
                <div key={name} className="truncate" style={{ color: "#8b7355" }}>
                  {name}: {p.currentAction.type}
                </div>
              ))}
            </div>
            <div className="mt-1 pt-1" style={{ borderTop: "1px solid #a67c52" }}>
              <div style={{ color: "#4a8c59" }}>Facilities:</div>
              {Object.entries(worldState.level.facilities).map(([id, f]) => (
                <div key={id} className="truncate" style={{ color: "#8b7355" }}>
                  {f.displayName} ({f.x}, {f.y})
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;

  const [session, setSession] = useState<{ worldId: string; pookieName: string } | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);

  // Get backend URL at runtime for mobile compatibility
  const backendUrl = useMemo(() => getBackendUrl(), []);

  const { worldState, connectionStatus } = useWorldState({
    worldId: gameId,
    autoReconnect: true,
  });

  const speechDistance = worldState?.level.speechDistance || DEFAULT_LEVEL.speechDistance;

  // Game world dimensions (for positioning calculations)
  const levelWidth = worldState?.level.width || DEFAULT_LEVEL.width;
  const levelHeight = worldState?.level.height || DEFAULT_LEVEL.height;

  // Actual image dimensions in pixels
  const mapWidthPx = worldState?.level.backgroundImage.widthPx || DEFAULT_LEVEL.backgroundImage.widthPx;
  const mapHeightPx = worldState?.level.backgroundImage.heightPx || DEFAULT_LEVEL.backgroundImage.heightPx;

  // Track when the session was set to avoid race conditions
  const sessionSetTimeRef = useRef<number>(0);

  // Check session on mount
  useEffect(() => {
    const existingSession = getSessionForWorld(gameId);
    if (existingSession) {
      sessionSetTimeRef.current = existingSession.joinedAt || Date.now();
      setSession({
        worldId: existingSession.worldId,
        pookieName: existingSession.pookieName,
      });
    }
  }, [gameId]);

  // Check if our pookie still exists in the world - if not, clear the stale session
  // But only if the session is old enough (give time for WebSocket to sync)
  useEffect(() => {
    if (session && worldState && connectionStatus === "connected") {
      if (!worldState.pookies[session.pookieName]) {
        // Only clear if session is older than 5 seconds (enough time for WS to sync)
        const sessionAge = Date.now() - sessionSetTimeRef.current;
        if (sessionAge > 5000) {
          // Our pookie no longer exists, clear the session
          console.log("[Session] Pookie no longer in world, clearing session");
          clearSession();
          setSession(null);
        }
      }
    }
  }, [session, worldState, connectionStatus]);

  // Join or rejoin the game
  const joinGame = useCallback(async () => {
    if (isJoining) return;
    setIsJoining(true);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/worlds/${gameId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to join game");
      }

      const data = await response.json();

      const joinedAt = Date.now();
      saveSession({
        worldId: gameId,
        pookieName: data.pookieName,
        deviceId: getDeviceId(),
        joinedAt,
      });

      sessionSetTimeRef.current = joinedAt;
      setSession({
        worldId: gameId,
        pookieName: data.pookieName,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join game");
    } finally {
      setIsJoining(false);
    }
  }, [gameId, isJoining, backendUrl]);

  const leaveGame = useCallback(() => {
    clearSession();
    router.push("/");
  }, [router]);

  const gameUrl = getShareableGameUrl(`/game/${gameId}`);
  const myPookie = session && worldState?.pookies[session.pookieName];

  // Send message as guardian angel
  const sendGuardianMessage = useCallback(async (message: string) => {
    if (!session) return;
    try {
      await fetch(`${backendUrl}/worlds/${gameId}/pookies/${session.pookieName}/guardian-angel/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
    } catch (err) {
      console.error("Failed to send guardian message:", err);
    }
  }, [gameId, session, backendUrl]);

  // Check if world exists
  if (connectionStatus === "error" || (connectionStatus === "connected" && !worldState)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(180deg, #d9c49a 0%, #c4a86e 100%)" }}>
        <div className="game-panel p-6 sm:p-8 text-center max-w-md w-full">
          <h1 className="text-xl sm:text-2xl font-bold mb-4" style={{ color: "#3d2814" }}>Game Not Found</h1>
          <p className="mb-6 text-sm sm:text-base" style={{ color: "#5c4a32" }}>
            The game <span style={{ color: "#4a8c59" }}>{gameId}</span> doesn&apos;t exist or has ended.
          </p>
          <PixelButton onClick={() => router.push("/")}>
            Back to Home
          </PixelButton>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex overflow-hidden" style={{ background: "linear-gradient(180deg, #c4a86e 0%, #a67c52 100%)" }}>
      {/* Map Section - hidden on mobile, flex-1 on desktop */}
      <div className="hidden md:flex flex-1 items-center justify-center relative overflow-hidden">
        {/* Map container - maintains aspect ratio and fits within available space */}
        <div
          className="relative"
          style={{
            width: `min(${mapWidthPx}px, calc(100vw - 320px), calc(100vh * ${mapWidthPx / mapHeightPx}))`,
            height: `min(${mapHeightPx}px, 100vh, calc((100vw - 320px) * ${mapHeightPx / mapWidthPx}))`,
            backgroundImage: `url(${worldState?.level.backgroundImage.url || "/Map.png"})`,
            backgroundSize: "100% 100%",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            border: "4px solid #5c3d1e",
            boxShadow: "0 0 0 2px #8b5e34, 8px 8px 0 rgba(0,0,0,0.3)",
            borderRadius: "4px",
          }}
        >
          {/* Render all pookies - positioned relative to the map container */}
          {worldState &&
            Object.entries(worldState.pookies).map(([pookieName, pookie]) => (
              <PookieSprite
                key={pookieName}
                name={pookieName}
                pookie={pookie}
                levelWidth={levelWidth}
                levelHeight={levelHeight}
                isOwn={session?.pookieName === pookieName}
                debugMode={debugMode}
                speechDistancePercent={(speechDistance / levelWidth) * 100}
              />
            ))}
        </div>

        {/* Map UI Overlays */}
        {/* Top Left - Compact Game Info & Controls */}
        <div className="absolute top-2 left-4 z-30">
          <div 
            className="px-3 py-2 text-sm"
            style={{
              background: "linear-gradient(180deg, #f7edd5 0%, #ebd9b4 100%)",
              border: "3px solid #8b5e34",
              borderRadius: "4px",
              boxShadow: "3px 3px 0 #5c3d1e",
            }}
          >
            {/* Game ID & Status - Single Row */}
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${connectionStatus === "connected"
                  ? "bg-green-500"
                  : connectionStatus === "connecting"
                    ? "bg-yellow-500 animate-pulse"
                    : "bg-red-500"
                  }`}
                style={{ border: "1px solid #5c3d1e" }}
              />
              <span className="font-bold truncate" style={{ color: "#3d2814" }}>{gameId}</span>
              <span className="text-xs" style={{ color: "#8b7355" }}>
                {worldState ? Object.keys(worldState.pookies).length : 0}/{worldState?.level.maxPookies || 10}
              </span>
            </div>

            {/* Session Info */}
            {session ? (
              <div className="space-y-1.5">
                <div className="text-xs truncate" style={{ color: "#4a8c59" }}>
                  🪽 {session.pookieName}
                  {!myPookie && <span style={{ color: "#8b7355" }} className="ml-1">(loading...)</span>}
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setShowQRDialog(true)}
                    className="px-2 py-0.5 text-xs rounded"
                    style={{
                      background: "#d9c49a",
                      border: "2px solid #8b5e34",
                      color: "#3d2814",
                    }}
                  >
                    📱
                  </button>
                  <button
                    onClick={() => setShowSystemPrompt(true)}
                    className="px-2 py-0.5 text-xs rounded"
                    style={{
                      background: "#d9c49a",
                      border: "2px solid #8b5e34",
                      color: "#3d2814",
                    }}
                  >
                    🧠
                  </button>
                  <button
                    onClick={leaveGame}
                    className="px-2 py-0.5 text-xs rounded"
                    style={{
                      background: "#dc2626",
                      border: "2px solid #991b1b",
                      color: "white",
                    }}
                  >
                    Exit
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {error && <p className="text-xs" style={{ color: "#dc2626" }}>{error}</p>}
                <button
                  onClick={joinGame}
                  disabled={isJoining || connectionStatus !== "connected"}
                  className="w-full px-2 py-1 text-xs rounded font-bold disabled:opacity-50"
                  style={{
                    background: "linear-gradient(180deg, #7cb587 0%, #4a8c59 100%)",
                    border: "2px solid #2d6b3d",
                    color: "white",
                    boxShadow: "2px 2px 0 #1a4a28",
                  }}
                >
                  {isJoining ? "..." : "🪽 Join"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Top Right - Debug Toggle */}
        <div className="absolute top-2 right-4 z-30">
          <button
            onClick={() => setDebugMode(!debugMode)}
            className="px-2 py-1 text-xs rounded"
            style={{
              background: debugMode ? "#d4914d" : "#d9c49a",
              border: `2px solid ${debugMode ? "#b5702d" : "#8b5e34"}`,
              color: debugMode ? "white" : "#3d2814",
              boxShadow: "2px 2px 0 #5c3d1e",
            }}
            title="Toggle Debug Mode"
          >
            🐛
          </button>
        </div>

        {/* Debug Panel */}
        <DebugPanel
          isOpen={debugMode}
          worldState={worldState}
          connectionStatus={connectionStatus}
        />
      </div>

      {/* Right Sidebar - always visible, full width on mobile */}
      <div className="w-full md:w-80 h-full flex flex-col bg-slate-900">
        {/* Mobile header with game info */}
        <div 
          className="md:hidden p-3"
          style={{
            background: "linear-gradient(180deg, #ebd9b4 0%, #d9c49a 100%)",
            borderBottom: "3px solid #8b5e34",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${connectionStatus === "connected"
                  ? "bg-green-500"
                  : connectionStatus === "connecting"
                    ? "bg-yellow-500 animate-pulse"
                    : "bg-red-500"
                  }`}
                style={{ border: "1px solid #5c3d1e" }}
              />
              <span className="font-bold text-sm" style={{ color: "#3d2814" }}>{gameId}</span>
              <span className="text-xs" style={{ color: "#8b7355" }}>
                {worldState ? Object.keys(worldState.pookies).length : 0}/{worldState?.level.maxPookies || 10}
              </span>
            </div>
            <div className="flex gap-1">
              {session ? (
                <>
                  <button
                    onClick={() => setShowQRDialog(true)}
                    className="px-2 py-1 text-xs rounded"
                    style={{
                      background: "#f7edd5",
                      border: "2px solid #8b5e34",
                      color: "#3d2814",
                    }}
                  >
                    📱
                  </button>
                  <button
                    onClick={leaveGame}
                    className="px-2 py-1 text-xs rounded"
                    style={{
                      background: "#dc2626",
                      border: "2px solid #991b1b",
                      color: "white",
                    }}
                  >
                    Exit
                  </button>
                </>
              ) : (
                <button
                  onClick={joinGame}
                  disabled={isJoining || connectionStatus !== "connected"}
                  className="px-3 py-1 text-xs rounded font-bold disabled:opacity-50"
                  style={{
                    background: "linear-gradient(180deg, #7cb587 0%, #4a8c59 100%)",
                    border: "2px solid #2d6b3d",
                    color: "white",
                  }}
                >
                  {isJoining ? "..." : "🪽 Join"}
                </button>
              )}
            </div>
          </div>
          {error && <p className="text-xs mt-1" style={{ color: "#dc2626" }}>{error}</p>}
        </div>

        {/* Sidebar content */}
        <div className="flex-1 overflow-hidden">
          <PookieSidebar
            worldState={worldState}
            session={session}
            onSendMessage={sendGuardianMessage}
          />
        </div>
      </div>

      {/* QR Code Dialog */}
      <QRCodeDialog
        isOpen={showQRDialog}
        onClose={() => setShowQRDialog(false)}
        gameCode={gameId}
        gameUrl={gameUrl}
      />

      {/* System Prompt Dialog */}
      {session && (
        <SystemPromptDialog
          isOpen={showSystemPrompt}
          onClose={() => setShowSystemPrompt(false)}
          pookieName={session.pookieName}
        />
      )}
    </div>
  );
}
