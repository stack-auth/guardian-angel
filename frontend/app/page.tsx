'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  useWorldState,
  getPookiePosition,
  getPookieFacingDirection,
  isPookieMoving,
} from './useWorldState';
import type { Pookie, PookieThought, WorldState } from './types';

const DEFAULT_WORLD_ID = 'demo-world';

// Default level configuration for creating a new world
const DEFAULT_LEVEL = {
  maxPlayers: 10,
  width: 100,
  height: 100,
  speechDistance: 10,
  walkSpeedPerSecond: 5,
  backgroundImage: {
    url: '/Map.png',
    scale: 0.1, // 10 pixels = 1 unit
  },
  itemTypes: {},
  facilities: {
    'campfire': {
      x: 50,
      y: 50,
      displayName: 'Campfire',
      interactionPrompt: 'Warm yourself by the fire',
      interactionName: 'warm',
      variables: {},
    },
    'well': {
      x: 30,
      y: 70,
      displayName: 'Well',
      interactionPrompt: 'Draw water from the well',
      interactionName: 'draw-water',
      variables: {},
    },
  },
};

function ThoughtBubble({ message }: { message: string }) {
  return (
    <div className="thought-bubble">
      {message}
    </div>
  );
}

// Color palette for pookies - each color has base, light, dark, and border variants
const POOKIE_COLORS = [
  { base: '#60a5fa', light: '#93c5fd', dark: '#2563eb', darker: '#1e40af', border: '#1e3a8a' }, // blue
  { base: '#f87171', light: '#fca5a5', dark: '#dc2626', darker: '#b91c1c', border: '#7f1d1d' }, // red
  { base: '#4ade80', light: '#86efac', dark: '#16a34a', darker: '#15803d', border: '#14532d' }, // green
  { base: '#facc15', light: '#fde047', dark: '#ca8a04', darker: '#a16207', border: '#713f12' }, // yellow
  { base: '#c084fc', light: '#d8b4fe', dark: '#9333ea', darker: '#7e22ce', border: '#581c87' }, // purple
  { base: '#fb923c', light: '#fdba74', dark: '#ea580c', darker: '#c2410c', border: '#7c2d12' }, // orange
  { base: '#2dd4bf', light: '#5eead4', dark: '#0d9488', darker: '#0f766e', border: '#134e4a' }, // teal
  { base: '#f472b6', light: '#f9a8d4', dark: '#db2777', darker: '#be185d', border: '#831843' }, // pink
  { base: '#a78bfa', light: '#c4b5fd', dark: '#7c3aed', darker: '#6d28d9', border: '#4c1d95' }, // violet
  { base: '#38bdf8', light: '#7dd3fc', dark: '#0284c7', darker: '#0369a1', border: '#075985' }, // sky
];

// Generate a deterministic color index based on pookie name
function getPookieColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % POOKIE_COLORS.length;
}

interface PookieSpriteProps {
  pookie: Pookie;
  name: string;
  scale: number;
}

function PookieSprite({ pookie, name, scale }: PookieSpriteProps) {
  const [position, setPosition] = useState(() => getPookiePosition(pookie.currentAction));
  const animationFrameRef = useRef<number | null>(null);

  // Get deterministic color for this pookie
  const color = POOKIE_COLORS[getPookieColorIndex(name)];

  // Get the latest thought for display
  const latestThought = pookie.thoughts.length > 0
    ? pookie.thoughts[pookie.thoughts.length - 1]
    : null;
  const showThought = latestThought && Date.now() - latestThought.timestampMillis < 5000;

  // Animate position for moving pookies
  useEffect(() => {
    let isActive = true;

    const animate = () => {
      if (!isActive) return;

      const now = Date.now();
      const newPosition = getPookiePosition(pookie.currentAction, now);
      setPosition(newPosition);

      // Keep animating if this is a move action and we haven't finished yet
      const shouldKeepAnimating =
        pookie.currentAction.type === 'move' &&
        now < pookie.currentAction.endTimestampMillis;

      if (shouldKeepAnimating) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    // Start animation immediately
    animate();

    return () => {
      isActive = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [pookie.currentAction]);

  const isMoving = isPookieMoving(pookie.currentAction, Date.now());
  const isThinking = pookie.currentAction.type === 'thinking';
  const isDead = pookie.currentAction.type === 'dead';
  const facingDirection = getPookieFacingDirection(pookie.currentAction);
  const facingLeft = facingDirection === 'left';

  // Convert world units to pixels
  const pixelX = position.x / scale;
  const pixelY = position.y / scale;

  return (
    <div
      className="absolute pixel-art"
      style={{
        left: `${pixelX}px`,
        top: `${pixelY}px`,
        transform: 'translate(-50%, -50%)',
        opacity: isDead ? 0.5 : 1,
        zIndex: Math.floor(pixelY),
      }}
    >
      {/* Pookie Name - outside the flipping container */}
      <div
        className="absolute left-1/2 text-xs font-bold text-white whitespace-nowrap"
        style={{
          transform: 'translateX(-50%)',
          textShadow: '1px 1px 2px black, -1px -1px 2px black',
          top: '-20px',
        }}
      >
        {name}
      </div>

      {/* Health/Food bars - outside the flipping container */}
      <div
        className="absolute left-1/2 flex flex-col gap-0.5"
        style={{
          transform: 'translateX(-50%)',
          top: '48px',
        }}
      >
        <div className="w-6 h-1 bg-gray-700 rounded-sm overflow-hidden">
          <div className="h-full bg-red-500" style={{ width: `${pookie.health}%` }} />
        </div>
        <div className="w-6 h-1 bg-gray-700 rounded-sm overflow-hidden">
          <div className="h-full bg-yellow-500" style={{ width: `${pookie.food}%` }} />
        </div>
      </div>

      {/* Character body - this flips when facing left */}
      <div
        className={`relative ${isMoving ? 'animate-moving' : ''} ${isThinking ? 'animate-talking' : ''}`}
        style={{ transform: facingLeft ? 'scaleX(-1)' : 'scaleX(1)' }}
      >
        {/* Shadow */}
        <div className="absolute left-1/2 top-full -translate-x-1/2 translate-y-0.5 w-3 h-0.5 bg-black/40 pixel-shadow" />

        {/* Thought Bubble */}
        {showThought && latestThought && (
          <div
            className="absolute bottom-full left-1/2 mb-6"
            style={{ transform: `translateX(-50%) ${facingLeft ? 'scaleX(-1)' : 'scaleX(1)'}` }}
          >
            <ThoughtBubble message={getThoughtText(latestThought)} />
          </div>
        )}

        {/* Thinking indicator */}
        {isThinking && (
          <div
            className="absolute left-1/2 text-lg"
            style={{
              transform: `translateX(-50%) ${facingLeft ? 'scaleX(-1)' : 'scaleX(1)'}`,
              top: '-28px',
            }}
          >
            💭
          </div>
        )}

        {/* Head */}
        <div
          className="w-4 h-4 relative z-10 pixel-head"
          style={{
            backgroundColor: color.base,
            border: `1px solid ${color.border}`,
            borderRadius: '1px',
          }}
        >
          <div className="absolute top-0 left-0 w-2.5 h-1.5" style={{ backgroundColor: color.light, borderRadius: '0' }} />
          <div className="absolute bottom-0 left-0 w-full h-0.5" style={{ backgroundColor: color.dark, borderRadius: '0' }} />
          <div className="absolute left-0.5 top-1 w-1 h-1 bg-white" style={{ border: `0.5px solid ${color.border}`, borderRadius: '0' }} />
          <div className="absolute right-0.5 top-1 w-1 h-1 bg-white" style={{ border: `0.5px solid ${color.border}`, borderRadius: '0' }} />
        </div>

        {/* Body */}
        <div
          className="absolute left-1/2 top-4 -translate-x-1/2 w-4 h-4 pixel-body"
          style={{
            backgroundColor: color.dark,
            border: `1px solid ${color.border}`,
            borderRadius: '1px 1px 0 0',
          }}
        >
          <div className="absolute top-0 left-0 w-2.5 h-1.5" style={{ backgroundColor: color.base, borderRadius: '0' }} />
          <div className="absolute bottom-0 left-0 w-full h-0.5" style={{ backgroundColor: color.darker, borderRadius: '0' }} />
          <div className="absolute top-0 right-0 w-0.5 h-full" style={{ backgroundColor: color.darker, borderRadius: '0' }} />
        </div>

        {/* Legs */}
        <div className="absolute left-1/2 top-8 -translate-x-1/2 flex gap-0.5 pixel-legs">
          <div
            className="w-1.5 h-2.5 pixel-leg-left"
            style={{
              backgroundColor: color.dark,
              border: `1px solid ${color.border}`,
              borderRadius: '0 0 1px 1px',
            }}
          >
            <div className="absolute bottom-0 left-0 w-full h-0.5" style={{ backgroundColor: color.darker, borderRadius: '0' }} />
          </div>
          <div
            className="w-1.5 h-2.5 pixel-leg-right"
            style={{
              backgroundColor: color.dark,
              border: `1px solid ${color.border}`,
              borderRadius: '0 0 1px 1px',
            }}
          >
            <div className="absolute bottom-0 left-0 w-full h-0.5" style={{ backgroundColor: color.darker, borderRadius: '0' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function getThoughtText(thought: PookieThought): string {
  switch (thought.source) {
    case 'self':
      return thought.text;
    case 'guardian-angel':
      return `🪽 ${thought.text}`;
    case 'facility':
      return `📍 ${thought.text}`;
    case 'self-action-change':
      return thought.text;
    default:
      return '';
  }
}

interface GameUIProps {
  worldState: WorldState | null;
  worldId: string;
  onJoinWorld: () => void;
}

function GameUI({ worldState, worldId, onJoinWorld }: GameUIProps) {
  const pookieCount = worldState ? Object.keys(worldState.pookies).length : 0;
  const maxPookies = worldState?.level.maxPlayers || 0;

  return (
    <div className="absolute top-4 left-4 bg-black/70 px-4 py-3 rounded-lg text-white">
      <div className="text-sm font-bold mb-2">World: {worldId}</div>
      <div className="text-xs mb-2">
        Pookies: {pookieCount} / {maxPookies}
      </div>
      <button
        onClick={onJoinWorld}
        disabled={pookieCount >= maxPookies}
        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
      >
        Join World
      </button>
    </div>
  );
}

export default function Home() {
  const [worldId] = useState<string>(DEFAULT_WORLD_ID);
  const [isWorldCreated, setIsWorldCreated] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const { worldState } = useWorldState({
    worldId,
    autoReconnect: true,
  });

  // Create world on initial load
  const createWorld = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);

    try {
      const response = await fetch(`http://localhost:3001/worlds/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldId,
          level: DEFAULT_LEVEL,
        }),
      });

      if (response.ok || response.status === 400) {
        // 400 might mean world already exists, which is fine
        setIsWorldCreated(true);
      }
    } catch (err) {
      console.error('Failed to create world:', err);
    } finally {
      setIsCreating(false);
    }
  }, [worldId, isCreating]);

  // Join world as a new pookie
  const joinWorld = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:3001/worlds/${worldId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`Joined as: ${data.pookieName}`);
      } else {
        const error = await response.json();
        console.error('Failed to join:', error);
      }
    } catch (err) {
      console.error('Failed to join world:', err);
    }
  }, [worldId]);

  // Auto-create world on mount
  useEffect(() => {
    if (!isWorldCreated) {
      createWorld();
    }
  }, [createWorld, isWorldCreated]);

  const scale = worldState?.level.backgroundImage.scale || DEFAULT_LEVEL.backgroundImage.scale;

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden"
      style={{
        backgroundImage: `url(${worldState?.level.backgroundImage.url || '/Map.png'})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Render all pookies */}
      {worldState && Object.entries(worldState.pookies).map(([pookieName, pookie]) => (
        <PookieSprite
          key={pookieName}
          name={pookieName}
          pookie={pookie}
          scale={scale}
        />
      ))}

      {/* Game UI */}
      <GameUI
        worldState={worldState}
        worldId={worldId}
        onJoinWorld={joinWorld}
      />
    </div>
  );
}
