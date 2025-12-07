"use client";

import { useState } from "react";
import type { PookieThought, WorldState } from "../types";

// Color palette for pookies (same as in game page)
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

function getPookieColor(name: string) {
  return POOKIE_COLORS[getPookieColorIndex(name)];
}

// Mini pookie avatar component
function MiniPookie({ name, size = 20 }: { name: string; size?: number }) {
  const color = getPookieColor(name);
  return (
    <div
      className="rounded-sm flex-shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: color.base,
        border: `1px solid ${color.border}`,
        boxShadow: `inset 0 ${size/8}px 0 ${color.light}, inset 0 -${size/8}px 0 ${color.dark}`,
      }}
    />
  );
}

// Format timestamp to relative time
function formatTime(timestampMillis: number): string {
  const now = Date.now();
  const diff = now - timestampMillis;
  
  if (diff < 60000) return "now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

// Thought message component
function ThoughtMessage({ 
  thought, 
  pookieName 
}: { 
  thought: PookieThought;
  pookieName: string;
}) {
  const pookieColor = getPookieColor(pookieName);
  
  // Guardian angel message - right side, golden
  if (thought.source === "guardian-angel") {
    return (
      <div className="flex justify-end mb-1">
        <div className="max-w-[85%]">
          <div 
            className="px-2 py-1 rounded-lg rounded-br-sm text-[11px] leading-tight"
            style={{
              backgroundColor: "#fef3c7",
              color: "#92400e",
            }}
          >
            {thought.text}
          </div>
          <div className="text-[9px] text-slate-500 text-right mt-0.5">
            🪽 {formatTime(thought.timestampMillis)}
          </div>
        </div>
      </div>
    );
  }
  
  // Self thought - left side, pookie's color
  if (thought.source === "self") {
    const isSpoken = thought.spokenLoudly;
    return (
      <div className="flex justify-start mb-1">
        <div className="max-w-[85%]">
          <div 
            className="px-2 py-1 rounded-lg rounded-bl-sm text-[11px] leading-tight"
            style={{
              backgroundColor: isSpoken ? pookieColor.base : pookieColor.light,
              color: isSpoken ? "white" : pookieColor.border,
              border: isSpoken ? "none" : `1px dashed ${pookieColor.dark}`,
            }}
          >
            {isSpoken ? "🗣️ " : "💭 "}{thought.text}
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">
            {isSpoken ? "said" : "thought"} · {formatTime(thought.timestampMillis)}
          </div>
        </div>
      </div>
    );
  }
  
  // Someone else said - left side with their avatar
  if (thought.source === "someone-else-said") {
    const sayerColor = getPookieColor(thought.sayerPookieName);
    return (
      <div className="flex justify-start gap-1.5 mb-1">
        <MiniPookie name={thought.sayerPookieName} size={18} />
        <div className="max-w-[75%]">
          <div 
            className="px-2 py-1 rounded-lg rounded-bl-sm text-[11px] leading-tight text-white"
            style={{
              backgroundColor: sayerColor.base,
            }}
          >
            {thought.text}
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">
            {thought.sayerPookieName} · {formatTime(thought.timestampMillis)}
          </div>
        </div>
      </div>
    );
  }
  
  // All other thought types - status message style (centered, no bubble)
  let statusText = "";
  let statusIcon = "📋";
  
  switch (thought.source) {
    case "facility":
      statusText = thought.text;
      statusIcon = "📍";
      break;
    case "self-action-change":
      statusText = thought.text;
      statusIcon = "🔄";
      break;
    case "trade-offer-received":
      statusText = `${thought.fromPookieName} offered trade`;
      statusIcon = "📦";
      break;
    case "trade-completed":
      statusText = `Trade with ${thought.withPookieName}`;
      statusIcon = "✅";
      break;
    case "trade-rejected":
      statusText = `${thought.byPookieName} rejected trade`;
      statusIcon = "❌";
      break;
    default:
      return null;
  }
  
  return (
    <div className="flex justify-center mb-1">
      <div className="text-[9px] text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full">
        {statusIcon} {statusText}
      </div>
    </div>
  );
}

interface PookieSidebarProps {
  worldState: WorldState | null;
  session: { worldId: string; pookieName: string } | null;
  onSendMessage?: (message: string) => void;
}

export function PookieSidebar({ worldState, session, onSendMessage }: PookieSidebarProps) {
  const [selectedPookie, setSelectedPookie] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  
  const pookieNames = worldState ? Object.keys(worldState.pookies) : [];
  const firstPookieName = pookieNames[0] || null;
  
  // Auto-select own pookie if available, otherwise first pookie
  const effectiveSelectedPookie = selectedPookie || session?.pookieName || firstPookieName;
  const selectedPookieData = effectiveSelectedPookie && worldState?.pookies[effectiveSelectedPookie];
  
  // Check if user can see thoughts (own pookie OR world creator = first pookie)
  const isOwnPookie = session?.pookieName === effectiveSelectedPookie;
  const isWorldCreator = session?.pookieName === firstPookieName;
  const canSeeThoughts = isOwnPookie || isWorldCreator;
  
  const handleSendMessage = () => {
    if (messageInput.trim() && onSendMessage && isOwnPookie) {
      onSendMessage(messageInput.trim());
      setMessageInput("");
    }
  };
  
  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-700">
      {/* Header with dropdown */}
      <div className="px-2 py-1.5 border-b border-slate-700">
        <select
          value={effectiveSelectedPookie || ""}
          onChange={(e) => setSelectedPookie(e.target.value || null)}
          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
        >
          {pookieNames.length === 0 && (
            <option value="">No pookies yet...</option>
          )}
          {pookieNames.map((name) => (
            <option key={name} value={name}>
              {session?.pookieName === name ? "🪽 " : ""}{name}
              {name === firstPookieName ? " ★" : ""}
            </option>
          ))}
        </select>
      </div>
      
      {/* Pookie Info */}
      {selectedPookieData && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Basic Info Section */}
          <div className="px-2 py-2 border-b border-slate-700 space-y-2">
            {/* Avatar and name */}
            <div className="flex items-center gap-2">
              <MiniPookie name={effectiveSelectedPookie!} size={28} />
              <div className="min-w-0 flex-1">
                <div className="text-white text-xs font-medium flex items-center gap-1 truncate">
                  {isOwnPookie && <span className="text-emerald-400">🪽</span>}
                  {effectiveSelectedPookie}
                </div>
                <div className="text-[10px] text-slate-400">
                  {selectedPookieData.currentAction.type}
                </div>
              </div>
            </div>
            
            {/* Health and Food bars */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 w-8">❤️</span>
                <div className="flex-1 h-1.5 bg-slate-700 rounded overflow-hidden">
                  <div 
                    className="h-full bg-red-500 transition-all" 
                    style={{ width: `${selectedPookieData.health}%` }} 
                  />
                </div>
                <span className="text-[10px] text-slate-500 w-6 text-right">{selectedPookieData.health}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 w-8">🍖</span>
                <div className="flex-1 h-1.5 bg-slate-700 rounded overflow-hidden">
                  <div 
                    className="h-full bg-yellow-500 transition-all" 
                    style={{ width: `${selectedPookieData.food}%` }} 
                  />
                </div>
                <span className="text-[10px] text-slate-500 w-6 text-right">{selectedPookieData.food}</span>
              </div>
            </div>
            
            {/* Personality */}
            <div>
              <div className="text-[10px] text-slate-300 bg-slate-800 rounded px-1.5 py-1 line-clamp-2 leading-tight">
                {selectedPookieData.personality || "No personality"}
              </div>
            </div>
            
            {/* Inventory */}
            {selectedPookieData.inventory.length > 0 && (
              <div className="flex flex-wrap gap-0.5">
                {selectedPookieData.inventory.map((item) => (
                  <span 
                    key={item.id} 
                    className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300"
                  >
                    {item.amount}× {item.id}
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* Thoughts Section - only visible to owner or world creator */}
          {canSeeThoughts ? (
            <>
              <div className="px-2 py-1 border-b border-slate-700 bg-slate-800/50">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  💭 Thoughts
                  {!isOwnPookie && <span className="text-amber-400">(creator view)</span>}
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto px-2 py-1.5 scrollbar-thin">
                {selectedPookieData.thoughts.length === 0 ? (
                  <div className="text-center text-slate-500 text-[10px] py-4">
                    No thoughts yet...
                  </div>
                ) : (
                  <>
                    {selectedPookieData.thoughts.map((thought, idx) => (
                      <ThoughtMessage 
                        key={idx} 
                        thought={thought} 
                        pookieName={effectiveSelectedPookie!}
                      />
                    ))}
                  </>
                )}
              </div>
              
              {/* Message input - only for own pookie */}
              {isOwnPookie && onSendMessage && (
                <div className="px-2 py-1.5 border-t border-slate-700">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      placeholder="Message as Guardian Angel..."
                      className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim()}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 rounded text-white text-xs"
                    >
                      🪽
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-2">
              <div className="text-center text-slate-500 text-[10px]">
                <div className="text-lg mb-1">🔒</div>
                <p>Private thoughts</p>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Empty state */}
      {!selectedPookieData && (
        <div className="flex-1 flex items-center justify-center p-2">
          <div className="text-center text-slate-500 text-[10px]">
            <div className="text-lg mb-1">👻</div>
            <p>No pookie selected</p>
          </div>
        </div>
      )}
    </div>
  );
}
