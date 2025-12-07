"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PixelButton } from "./components/PixelButton";
import { PixelInput } from "./components/PixelInput";
import { PixelDialog } from "./components/PixelDialog";
import { LevelEditor } from "./components/LevelEditor";
import { generateGameCode, normalizeGameCode } from "./lib/gameCode";
import { getBackendUrl, DEFAULT_LEVEL } from "./lib/gameConfig";
import { getSession, saveSession, clearSession, getDeviceId, GameSession } from "./lib/session";
import type { CustomLevel } from "./types";

export default function Home() {
  const router = useRouter();
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showCustomLevelDialog, setShowCustomLevelDialog] = useState(false);
  const [showLevelEditor, setShowLevelEditor] = useState(false);
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [existingSession, setExistingSession] = useState<GameSession | null>(null);
  const [isValidatingSession, setIsValidatingSession] = useState(true);

  // Get backend URL at runtime for mobile compatibility
  const backendUrl = useMemo(() => getBackendUrl(), []);

  // Check for existing session on mount and validate it
  useEffect(() => {
    const validateSession = async () => {
      const session = getSession();
      if (!session) {
        setIsValidatingSession(false);
        return;
      }

      try {
        // Check if the world still exists
        const response = await fetch(`${backendUrl}/worlds/${session.worldId}/state`);
        if (response.ok) {
          const worldState = await response.json();
          // Check if our pookie still exists in the world
          if (worldState.pookies && worldState.pookies[session.pookieName]) {
            setExistingSession(session);
          } else {
            // Pookie no longer exists, clear the session
            clearSession();
          }
        } else {
          // World no longer exists, clear the session
          clearSession();
        }
      } catch {
        // Network error or backend down, still show the session option
        // but let the game page handle validation
        setExistingSession(session);
      }
      setIsValidatingSession(false);
    };

    validateSession();
  }, [backendUrl]);

  const createGame = useCallback(async (customLevelConfig?: CustomLevel) => {
    if (isCreating) return;
    setIsCreating(true);
    setError("");

    try {
      const newGameCode = generateGameCode();

      // Use custom level config or default
      const levelConfig = customLevelConfig || DEFAULT_LEVEL;

      // Create the world on the backend
      const response = await fetch(`${backendUrl}/worlds/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worldId: newGameCode,
          level: levelConfig,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create game");
      }

      // Join the world as the first player
      const joinResponse = await fetch(`${backendUrl}/worlds/${newGameCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!joinResponse.ok) {
        throw new Error("Failed to join created game");
      }

      const joinData = await joinResponse.json();

      // Save session
      saveSession({
        worldId: newGameCode,
        pookieName: joinData.pookieName,
        deviceId: getDeviceId(),
        joinedAt: Date.now(),
      });

      // Close level editor if open
      setShowLevelEditor(false);
      setCustomBackgroundUrl("");

      // Navigate to game
      router.push(`/game/${newGameCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create game");
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, router, backendUrl]);

  const joinGame = useCallback(async () => {
    if (isJoining) return;

    const normalizedCode = normalizeGameCode(gameCode);

    if (!normalizedCode) {
      setError("Please enter a game code");
      return;
    }

    setIsJoining(true);
    setError("");

    try {
      // Check if world exists
      const stateResponse = await fetch(`${backendUrl}/worlds/${normalizedCode}/state`);

      if (!stateResponse.ok) {
        throw new Error("Game not found. Check the code and try again.");
      }

      // Check if this device already has a session for this world
      const existingSession = getSession();
      if (existingSession?.worldId === normalizedCode) {
        // Already in this game, just navigate
        router.push(`/game/${normalizedCode}`);
        return;
      }

      // Join the world
      const joinResponse = await fetch(`${backendUrl}/worlds/${normalizedCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!joinResponse.ok) {
        const data = await joinResponse.json();
        throw new Error(data.error || "Failed to join game");
      }

      const joinData = await joinResponse.json();

      // Save session
      saveSession({
        worldId: normalizedCode,
        pookieName: joinData.pookieName,
        deviceId: getDeviceId(),
        joinedAt: Date.now(),
      });

      // Navigate to game
      router.push(`/game/${normalizedCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join game");
    } finally {
      setIsJoining(false);
    }
  }, [gameCode, isJoining, router, backendUrl]);

  const continueGame = useCallback(() => {
    if (existingSession) {
      router.push(`/game/${existingSession.worldId}`);
    }
  }, [existingSession, router]);

  const leaveCurrentGame = useCallback(() => {
    clearSession();
    setExistingSession(null);
  }, []);

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-4"
      style={{
        backgroundImage: "url(/Map.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay - warm sepia tint */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(92, 61, 30, 0.7) 0%, rgba(61, 40, 20, 0.8) 100%)" }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 max-w-md w-full">
        {/* Logo/Title */}
        <div className="text-center">
          <h1 
            className="text-5xl font-bold mb-2 pixel-text drop-shadow-lg"
            style={{ 
              color: "#f7edd5",
              textShadow: "3px 3px 0 #5c3d1e, -1px -1px 0 #3d2814",
            }}
          >
            POOKIEVERSE
          </h1>
          <p style={{ color: "#d9c49a" }}>
            Guide in need is a guide indeed
          </p>
        </div>

        {/* Main Menu Card */}
        <div 
          className="w-full p-6 space-y-4"
          style={{
            background: "linear-gradient(180deg, #f7edd5 0%, #ebd9b4 100%)",
            border: "4px solid #8b5e34",
            borderRadius: "8px",
            boxShadow: "inset 0 2px 0 rgba(255,255,255,0.5), 6px 6px 0 #5c3d1e",
          }}
        >
          {/* Loading Session */}
          {isValidatingSession && (
            <div className="text-center py-2">
              <p style={{ color: "#8b7355" }}>Checking for existing game...</p>
            </div>
          )}

          {/* Existing Session Banner */}
          {!isValidatingSession && existingSession && (
            <div 
              className="p-4 mb-4"
              style={{
                background: "linear-gradient(180deg, #7cb587 0%, #4a8c59 100%)",
                border: "3px solid #2d6b3d",
                borderRadius: "4px",
                boxShadow: "3px 3px 0 #1a4a28",
              }}
            >
              <p className="mb-2" style={{ color: "#f7edd5" }}>
                <span className="font-bold">Active Game Found!</span>
              </p>
              <p className="text-sm mb-3" style={{ color: "#d9f7de" }}>
                You&apos;re playing as <span className="font-bold" style={{ color: "#fef9e7" }}>{existingSession.pookieName}</span> in{" "}
                <span style={{ color: "#fef9e7" }}>{existingSession.worldId}</span>
              </p>
              <div className="flex gap-2">
                <PixelButton size="sm" onClick={continueGame} className="flex-1">
                  Continue
                </PixelButton>
                <PixelButton
                  size="sm"
                  variant="danger"
                  onClick={leaveCurrentGame}
                  className="flex-1"
                >
                  Leave Game
                </PixelButton>
              </div>
            </div>
          )}

          {/* Create Game Button */}
          <PixelButton
            size="lg"
            onClick={() => createGame()}
            disabled={isCreating || isValidatingSession}
            className="w-full"
          >
            {isCreating ? "Creating..." : "🎮 Create New Game"}
          </PixelButton>

          {/* Custom Level Button */}
          <PixelButton
            size="lg"
            variant="secondary"
            onClick={() => setShowCustomLevelDialog(true)}
            disabled={isCreating || isValidatingSession}
            className="w-full"
          >
            🎨 Custom Level
          </PixelButton>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px" style={{ background: "#a67c52" }} />
            <span className="text-xs uppercase" style={{ color: "#8b7355" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "#a67c52" }} />
          </div>

          {/* Join Game Button */}
          <PixelButton
            size="lg"
            variant="secondary"
            onClick={() => setShowJoinDialog(true)}
            disabled={isValidatingSession}
            className="w-full"
          >
            🔗 Join Game
          </PixelButton>

          {/* Error Display */}
          {error && (
            <div 
              className="p-3 rounded"
              style={{
                background: "#fecaca",
                border: "2px solid #dc2626",
                color: "#991b1b",
              }}
            >
              <p className="text-xs">{error}</p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div 
          className="text-center text-sm space-y-1"
          style={{ color: "#ebd9b4" }}
        >
          <p>🪽 You are the Guardian Angel</p>
          <p>👾 Your Pookie will explore and make decisions</p>
          <p>💬 Guide them with your wisdom</p>
        </div>
      </div>

      {/* Join Game Dialog */}
      <PixelDialog
        isOpen={showJoinDialog}
        onClose={() => {
          setShowJoinDialog(false);
          setGameCode("");
          setError("");
        }}
        title="Join Game"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "#5c4a32" }}>
            Enter the game code shared by the game creator.
          </p>

          <PixelInput
            label="Game Code"
            placeholder="e.g., happy-tiger-42"
            value={gameCode}
            onChange={(e) => {
              setGameCode(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") joinGame();
            }}
            error={error}
          />

          <div className="flex gap-3">
            <PixelButton
              onClick={joinGame}
              disabled={isJoining || !gameCode.trim()}
              className="flex-1"
            >
              {isJoining ? "Joining..." : "Join"}
            </PixelButton>
            <PixelButton
              variant="secondary"
              onClick={() => {
                setShowJoinDialog(false);
                setGameCode("");
                setError("");
              }}
              className="flex-1"
            >
              Cancel
            </PixelButton>
          </div>
        </div>
      </PixelDialog>

      {/* Custom Level Dialog */}
      <PixelDialog
        isOpen={showCustomLevelDialog}
        onClose={() => {
          setShowCustomLevelDialog(false);
          setCustomBackgroundUrl("");
          setError("");
        }}
        title="Custom Level"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "#5c4a32" }}>
            Paste an image URL to use as a custom background for your game world.
          </p>

          <PixelInput
            label="Background Image URL"
            placeholder="https://example.com/image.png"
            value={customBackgroundUrl}
            onChange={(e) => {
              setCustomBackgroundUrl(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && customBackgroundUrl.trim()) {
                setShowCustomLevelDialog(false);
                setShowLevelEditor(true);
              }
            }}
            error={error}
          />

          {/* Preview */}
          {customBackgroundUrl.trim() && (
            <div 
              className="p-2 rounded"
              style={{ 
                border: "2px solid #8b5e34",
                background: "#d9c49a",
              }}
            >
              <p className="text-xs mb-2" style={{ color: "#5c4a32" }}>Preview:</p>
              <div 
                className="relative w-full h-32 overflow-hidden rounded"
                style={{ background: "#c4a86e" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={customBackgroundUrl}
                  alt="Background preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                  onLoad={(e) => {
                    (e.target as HTMLImageElement).style.display = "block";
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <PixelButton
              onClick={() => {
                setShowCustomLevelDialog(false);
                setShowLevelEditor(true);
              }}
              disabled={!customBackgroundUrl.trim()}
              className="flex-1"
            >
              Next: Place Facilities →
            </PixelButton>
            <PixelButton
              variant="secondary"
              onClick={() => {
                setShowCustomLevelDialog(false);
                setCustomBackgroundUrl("");
                setError("");
              }}
              className="flex-1"
            >
              Cancel
            </PixelButton>
          </div>
        </div>
      </PixelDialog>

      {/* Level Editor */}
      {showLevelEditor && (
        <LevelEditor
          backgroundImageUrl={customBackgroundUrl}
          onCreateGame={createGame}
          onBack={() => {
            setShowLevelEditor(false);
            setShowCustomLevelDialog(true);
          }}
          isCreating={isCreating}
        />
      )}
    </div>
  );
}
