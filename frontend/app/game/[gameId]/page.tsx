"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import { ChatPanel } from "../../components/ChatPanel";
import { SystemPromptDialog } from "../../components/SystemPromptDialog";
import {
  getSessionForWorld,
  saveSession,
  clearSession,
  getDeviceId,
} from "../../lib/session";
import { BACKEND_URL, DEFAULT_LEVEL } from "../../lib/gameConfig";
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
  scale: number;
  isOwn: boolean;
  debugMode: boolean;
  speechDistance: number;
  onClick?: () => void;
}

function PookieSprite({ pookie, name, scale, isOwn, debugMode, speechDistance, onClick }: PookieSpriteProps) {
  const [position, setPosition] = useState(() => getPookiePosition(pookie.currentAction));
  const animationFrameRef = useRef<number | null>(null);

  const color = POOKIE_COLORS[getPookieColorIndex(name)];

  const latestThought = pookie.thoughts.length > 0
    ? pookie.thoughts[pookie.thoughts.length - 1]
    : null;
  const showThought = latestThought && Date.now() - latestThought.timestampMillis < 5000;

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

  const isMoving = isPookieMoving(pookie.currentAction, Date.now());
  const isThinking = pookie.currentAction.type === "thinking";
  const isDead = pookie.currentAction.type === "dead";
  const isInteracting = pookie.currentAction.type === "interact-with-facility";
  const facingDirection = getPookieFacingDirection(pookie.currentAction);
  const facingLeft = facingDirection === "left";

  // Convert world units to pixels
  const pixelX = position.x / scale;
  const pixelY = position.y / scale;

  // Calculate speech distance circle radius in pixels
  const speechRadiusPixels = speechDistance / scale;

  return (
    <div
      className={`absolute pixel-art ${onClick ? "cursor-pointer" : ""}`}
      style={{
        left: `${pixelX}px`,
        top: `${pixelY}px`,
        transform: "translate(-50%, -50%)",
        opacity: isDead ? 0.5 : 1,
        zIndex: Math.floor(pixelY),
      }}
      onClick={onClick}
    >
      {/* Debug: Speech distance circle */}
      {debugMode && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: `${speechRadiusPixels * 2}px`,
            height: `${speechRadiusPixels * 2}px`,
            left: `${-speechRadiusPixels}px`,
            top: `${-speechRadiusPixels}px`,
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

      {/* Health/Food bars */}
      <div
        className="absolute left-1/2 flex flex-col gap-0.5"
        style={{
          transform: "translateX(-50%)",
          top: "48px",
        }}
      >
        <div className="w-6 h-1 bg-gray-700 rounded-sm overflow-hidden">
          <div className="h-full bg-red-500" style={{ width: `${pookie.health}%` }} />
        </div>
        <div className="w-6 h-1 bg-gray-700 rounded-sm overflow-hidden">
          <div className="h-full bg-yellow-500" style={{ width: `${pookie.food}%` }} />
        </div>
      </div>

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
        className={`relative ${isMoving ? "animate-moving" : ""} ${isThinking ? "animate-talking" : ""}`}
        style={{ transform: facingLeft ? "scaleX(-1)" : "scaleX(1)" }}
      >
        {/* Shadow */}
        <div className="absolute left-1/2 top-full -translate-x-1/2 translate-y-0.5 w-3 h-0.5 bg-black/40 pixel-shadow" />

        {/* Thought Bubble */}
        {showThought && latestThought && (
          <div
            className="absolute bottom-full left-1/2 mb-6"
            style={{ transform: `translateX(-50%) ${facingLeft ? "scaleX(-1)" : "scaleX(1)"}` }}
          >
            <ThoughtBubble message={getThoughtText(latestThought)} />
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
            className="absolute left-1/2 text-lg animate-bounce"
            style={{
              transform: `translateX(-50%) ${facingLeft ? "scaleX(-1)" : "scaleX(1)"}`,
              top: "-28px",
            }}
          >
            ⚡
          </div>
        )}

        {/* Head */}
        <div
          className="w-4 h-4 relative z-10 pixel-head"
          style={{
            backgroundColor: color.base,
            border: `1px solid ${color.border}`,
            borderRadius: "1px",
          }}
        >
          <div className="absolute top-0 left-0 w-2.5 h-1.5" style={{ backgroundColor: color.light, borderRadius: "0" }} />
          <div className="absolute bottom-0 left-0 w-full h-0.5" style={{ backgroundColor: color.dark, borderRadius: "0" }} />
          <div className="absolute left-0.5 top-1 w-1 h-1 bg-white" style={{ border: `0.5px solid ${color.border}`, borderRadius: "0" }} />
          <div className="absolute right-0.5 top-1 w-1 h-1 bg-white" style={{ border: `0.5px solid ${color.border}`, borderRadius: "0" }} />
        </div>

        {/* Body */}
        <div
          className="absolute left-1/2 top-4 -translate-x-1/2 w-4 h-4 pixel-body"
          style={{
            backgroundColor: color.dark,
            border: `1px solid ${color.border}`,
            borderRadius: "1px 1px 0 0",
          }}
        >
          <div className="absolute top-0 left-0 w-2.5 h-1.5" style={{ backgroundColor: color.base, borderRadius: "0" }} />
          <div className="absolute bottom-0 left-0 w-full h-0.5" style={{ backgroundColor: color.darker, borderRadius: "0" }} />
          <div className="absolute top-0 right-0 w-0.5 h-full" style={{ backgroundColor: color.darker, borderRadius: "0" }} />
        </div>

        {/* Legs */}
        <div className="absolute left-1/2 top-8 -translate-x-1/2 flex gap-0.5 pixel-legs">
          <div
            className="w-1.5 h-2.5 pixel-leg-left"
            style={{
              backgroundColor: color.dark,
              border: `1px solid ${color.border}`,
              borderRadius: "0 0 1px 1px",
            }}
          >
            <div className="absolute bottom-0 left-0 w-full h-0.5" style={{ backgroundColor: color.darker, borderRadius: "0" }} />
          </div>
          <div
            className="w-1.5 h-2.5 pixel-leg-right"
            style={{
              backgroundColor: color.dark,
              border: `1px solid ${color.border}`,
              borderRadius: "0 0 1px 1px",
            }}
          >
            <div className="absolute bottom-0 left-0 w-full h-0.5" style={{ backgroundColor: color.darker, borderRadius: "0" }} />
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
    <div className="absolute top-12 right-2 z-40 bg-slate-900/95 border border-slate-600 p-2 text-xs font-mono max-w-64 max-h-80 overflow-auto scrollbar-thin">
      <div className="text-emerald-400 font-bold mb-1">Debug Info</div>
      <div className="space-y-1 text-slate-300">
        <div>Connection: <span className={connectionStatus === "connected" ? "text-green-400" : "text-yellow-400"}>{connectionStatus}</span></div>
        <div>Pookies: {pookieCount}</div>
        <div>Facilities: {facilityCount}</div>
        {worldState && (
          <>
            <div>Speech Distance: {worldState.level.speechDistance} units</div>
            <div>Facility Distance: {worldState.level.facilityInteractionDistance} units</div>
            <div>Map Size: {worldState.level.width}x{worldState.level.height}</div>
            <div className="border-t border-slate-600 mt-1 pt-1">
              <div className="text-amber-400">Pookie States:</div>
              {Object.entries(worldState.pookies).map(([name, p]) => (
                <div key={name} className="text-slate-400 truncate">
                  {name}: {p.currentAction.type}
                </div>
              ))}
            </div>
            <div className="border-t border-slate-600 mt-1 pt-1">
              <div className="text-cyan-400">Facilities:</div>
              {Object.entries(worldState.level.facilities).map(([id, f]) => (
                <div key={id} className="text-slate-400 truncate">
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
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const { worldState, connectionStatus } = useWorldState({
    worldId: gameId,
    autoReconnect: true,
  });

  const scale = worldState?.level.backgroundImage.scale || DEFAULT_LEVEL.backgroundImage.scale;
  const speechDistance = worldState?.level.speechDistance || DEFAULT_LEVEL.speechDistance;

  // Check session on mount
  useEffect(() => {
    const existingSession = getSessionForWorld(gameId);
    if (existingSession) {
      setSession({
        worldId: existingSession.worldId,
        pookieName: existingSession.pookieName,
      });
    }
  }, [gameId]);

  // Check if our pookie still exists in the world - if not, clear the stale session
  useEffect(() => {
    if (session && worldState && connectionStatus === "connected") {
      if (!worldState.pookies[session.pookieName]) {
        // Our pookie no longer exists, clear the session
        clearSession();
        setSession(null);
      }
    }
  }, [session, worldState, connectionStatus]);

  // Join or rejoin the game
  const joinGame = useCallback(async () => {
    if (isJoining) return;
    setIsJoining(true);
    setError(null);

    try {
      const response = await fetch(`${BACKEND_URL}/worlds/${gameId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to join game");
      }

      const data = await response.json();

      saveSession({
        worldId: gameId,
        pookieName: data.pookieName,
        deviceId: getDeviceId(),
        joinedAt: Date.now(),
      });

      setSession({
        worldId: gameId,
        pookieName: data.pookieName,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join game");
    } finally {
      setIsJoining(false);
    }
  }, [gameId, isJoining]);

  const leaveGame = useCallback(() => {
    clearSession();
    router.push("/");
  }, [router]);

  const gameUrl = getShareableGameUrl(`/game/${gameId}`);
  const myPookie = session && worldState?.pookies[session.pookieName];

  // Check if world exists
  if (connectionStatus === "error" || (connectionStatus === "connected" && !worldState)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="bg-slate-800 border-4 border-slate-600 p-6 sm:p-8 text-center max-w-md w-full">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-4">Game Not Found</h1>
          <p className="text-slate-400 mb-6 text-sm sm:text-base">
            The game <span className="text-emerald-400 font-mono">{gameId}</span> doesn&apos;t exist or has ended.
          </p>
          <PixelButton onClick={() => router.push("/")}>
            Back to Home
          </PixelButton>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden"
      style={{
        backgroundImage: `url(${worldState?.level.backgroundImage.url || "/Map.png"})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Render all pookies */}
      {worldState &&
        Object.entries(worldState.pookies).map(([pookieName, pookie]) => (
          <PookieSprite
            key={pookieName}
            name={pookieName}
            pookie={pookie}
            scale={scale}
            isOwn={session?.pookieName === pookieName}
            debugMode={debugMode}
            speechDistance={speechDistance}
          />
        ))}

      {/* UI Overlay - Toggle button for mobile */}
      <button
        className="absolute top-2 left-2 z-50 sm:hidden bg-slate-900/90 border border-slate-600 px-2 py-1 text-white text-xs rounded"
        onClick={() => setShowControls(!showControls)}
      >
        {showControls ? "✕" : "☰"}
      </button>

      {/* Top Left - Compact Game Info & Controls */}
      <div className={`absolute top-2 left-2 sm:left-4 z-30 ${showControls ? "block" : "hidden"} sm:block`}>
        <div className="bg-slate-900/90 border border-slate-600 px-2 sm:px-3 py-2 text-xs sm:text-sm max-w-[200px] sm:max-w-none">
          {/* Game ID & Status - Single Row */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${connectionStatus === "connected"
                ? "bg-emerald-500"
                : connectionStatus === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
                }`}
            />
            <span className="text-white font-bold font-mono truncate">{gameId}</span>
            <span className="text-slate-500 text-xs">
              {worldState ? Object.keys(worldState.pookies).length : 0}/{worldState?.level.maxPookies || 10}
            </span>
          </div>

          {/* Session Info */}
          {session ? (
            <div className="space-y-1.5">
              <div className="text-emerald-300 text-xs truncate">
                🪽 {session.pookieName}
                {!myPookie && <span className="text-slate-500 ml-1">(loading...)</span>}
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setShowQRDialog(true)}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-2 py-0.5 text-xs rounded"
                >
                  📱
                </button>
                <button
                  onClick={() => setShowSystemPrompt(true)}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-2 py-0.5 text-xs rounded"
                >
                  🧠
                </button>
                <button
                  onClick={leaveGame}
                  className="bg-red-900/50 hover:bg-red-800 text-red-300 px-2 py-0.5 text-xs rounded"
                >
                  Exit
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                onClick={joinGame}
                disabled={isJoining || connectionStatus !== "connected"}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-2 py-1 text-xs rounded font-bold"
              >
                {isJoining ? "..." : "🪽 Join"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Top Right - Debug Toggle */}
      <div className="absolute top-2 right-2 sm:right-4 z-30">
        <button
          onClick={() => setDebugMode(!debugMode)}
          className={`px-2 py-1 text-xs rounded border ${debugMode
            ? "bg-amber-900/90 border-amber-600 text-amber-300"
            : "bg-slate-900/90 border-slate-600 text-slate-400 hover:text-white"
            }`}
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

      {/* Chat Panel (show if session exists, even if pookie not yet in world state) */}
      {session && (
        <ChatPanel
          worldId={gameId}
          pookieName={session.pookieName}
          thoughts={myPookie?.thoughts || []}
          isCollapsed={isChatCollapsed}
          onToggle={() => setIsChatCollapsed(!isChatCollapsed)}
        />
      )}

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
