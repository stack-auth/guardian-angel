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
            className="px-2 py-1 rounded text-[13px] leading-tight"
            style={{
              backgroundColor: "#fef9e7",
              color: "#92400e",
              border: "2px solid #d4914d",
              boxShadow: "2px 2px 0 #b5702d",
            }}
          >
            {thought.text}
          </div>
          <div className="text-[11px] text-right mt-0.5" style={{ color: "#8b7355" }}>
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
            className="px-2 py-1 rounded text-[13px] leading-tight"
            style={{
              backgroundColor: isSpoken ? pookieColor.base : pookieColor.light,
              color: isSpoken ? "white" : pookieColor.border,
              border: `2px ${isSpoken ? "solid" : "dashed"} ${pookieColor.dark}`,
              boxShadow: isSpoken ? `2px 2px 0 ${pookieColor.darker}` : "none",
            }}
          >
            {isSpoken ? "🗣️ " : "💭 "}{thought.text}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: "#8b7355" }}>
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
            className="px-2 py-1 rounded text-[13px] leading-tight text-white"
            style={{
              backgroundColor: sayerColor.base,
              border: `2px solid ${sayerColor.dark}`,
              boxShadow: `2px 2px 0 ${sayerColor.darker}`,
            }}
          >
            {thought.text}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: "#8b7355" }}>
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
      <div 
        className="text-[11px] px-2 py-0.5 rounded-full"
        style={{ 
          backgroundColor: "#d9c49a",
          color: "#5c4a32",
          border: "1px solid #a67c52",
        }}
      >
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
    <div 
      className="h-full flex flex-col"
      style={{
        background: "linear-gradient(180deg, #f7edd5 0%, #ebd9b4 100%)",
        borderLeft: "3px solid #8b5e34",
        boxShadow: "inset 2px 0 0 rgba(255,255,255,0.3)",
      }}
    >
      {/* Header with dropdown */}
      <div 
        className="px-2 py-1.5"
        style={{ 
          borderBottom: "2px solid #a67c52",
          background: "linear-gradient(180deg, #ebd9b4 0%, #d9c49a 100%)",
        }}
      >
        <select
          value={effectiveSelectedPookie || ""}
          onChange={(e) => setSelectedPookie(e.target.value || null)}
          className="w-full rounded px-2 py-1 text-[14px] focus:outline-none"
          style={{
            background: "#f7edd5",
            border: "2px solid #8b5e34",
            color: "#3d2814",
            boxShadow: "inset 1px 1px 0 #d9c49a, 2px 2px 0 #5c3d1e",
          }}
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
          <div 
            className="px-2 py-2 space-y-2"
            style={{ borderBottom: "2px solid #a67c52" }}
          >
            {/* Avatar and name */}
            <div className="flex items-center gap-2">
              <MiniPookie name={effectiveSelectedPookie!} size={28} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium flex items-center gap-1 truncate" style={{ color: "#3d2814" }}>
                  {isOwnPookie && <span style={{ color: "#4a8c59" }}>🪽</span>}
                  {effectiveSelectedPookie}
                </div>
                <div className="text-[12px]" style={{ color: "#8b7355" }}>
                  {selectedPookieData.currentAction.type}
                </div>
              </div>
            </div>
            
            {/* Health and Food bars */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] w-8" style={{ color: "#5c4a32" }}>❤️</span>
                <div 
                  className="flex-1 h-2 rounded overflow-hidden"
                  style={{ 
                    background: "#d9c49a",
                    border: "1px solid #8b5e34",
                    boxShadow: "inset 1px 1px 0 rgba(0,0,0,0.1)",
                  }}
                >
                  <div 
                    className="h-full transition-all" 
                    style={{ 
                      width: `${selectedPookieData.health}%`,
                      background: "linear-gradient(180deg, #ef4444 0%, #dc2626 100%)",
                    }} 
                  />
                </div>
                <span className="text-[12px] w-6 text-right" style={{ color: "#8b7355" }}>{selectedPookieData.health}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] w-8" style={{ color: "#5c4a32" }}>🍖</span>
                <div 
                  className="flex-1 h-2 rounded overflow-hidden"
                  style={{ 
                    background: "#d9c49a",
                    border: "1px solid #8b5e34",
                    boxShadow: "inset 1px 1px 0 rgba(0,0,0,0.1)",
                  }}
                >
                  <div 
                    className="h-full transition-all" 
                    style={{ 
                      width: `${selectedPookieData.food}%`,
                      background: "linear-gradient(180deg, #f59e0b 0%, #d97706 100%)",
                    }} 
                  />
                </div>
                <span className="text-[12px] w-6 text-right" style={{ color: "#8b7355" }}>{selectedPookieData.food}</span>
              </div>
            </div>
            
            {/* Personality */}
            <div>
              <div 
                className="text-[12px] rounded px-1.5 py-1 line-clamp-2 leading-tight"
                style={{
                  background: "#f7edd5",
                  color: "#5c4a32",
                  border: "1px solid #a67c52",
                }}
              >
                {selectedPookieData.personality || "No personality"}
              </div>
            </div>
            
            {/* Inventory */}
            {selectedPookieData.inventory.length > 0 && (
              <div className="flex flex-wrap gap-0.5">
                {selectedPookieData.inventory.map((item) => (
                  <span 
                    key={item.id} 
                    className="text-[12px] px-1.5 py-0.5 rounded"
                    style={{
                      background: "#d9c49a",
                      color: "#3d2814",
                      border: "1px solid #8b5e34",
                    }}
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
              <div 
                className="px-2 py-1"
                style={{ 
                  borderBottom: "2px solid #a67c52",
                  background: "#d9c49a",
                }}
              >
                <div className="text-[12px] flex items-center gap-1" style={{ color: "#5c4a32" }}>
                  💭 Thoughts
                  {!isOwnPookie && <span style={{ color: "#d4914d" }}>(creator view)</span>}
                </div>
              </div>
              
              <div 
                className="flex-1 overflow-y-auto px-2 py-1.5 scrollbar-thin"
                style={{ background: "#f7edd5" }}
              >
                {selectedPookieData.thoughts.length === 0 ? (
                  <div className="text-center text-[12px] py-4" style={{ color: "#8b7355" }}>
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
                <div 
                  className="px-2 py-1.5"
                  style={{ 
                    borderTop: "2px solid #a67c52",
                    background: "#d9c49a",
                  }}
                >
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      placeholder="Message as Guardian Angel..."
                      className="flex-1 rounded px-2 py-1 text-[13px] focus:outline-none"
                      style={{
                        background: "#f7edd5",
                        border: "2px solid #8b5e34",
                        color: "#3d2814",
                        boxShadow: "inset 1px 1px 0 #d9c49a",
                      }}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim()}
                      className="px-2 py-1 rounded text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: "linear-gradient(180deg, #7cb587 0%, #4a8c59 100%)",
                        border: "2px solid #2d6b3d",
                        color: "white",
                        boxShadow: "2px 2px 0 #1a4a28",
                        textShadow: "1px 1px 0 #2d6b3d",
                      }}
                    >
                      🪽
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div 
              className="flex-1 flex items-center justify-center p-2"
              style={{ background: "#f7edd5" }}
            >
              <div className="text-center text-[12px]" style={{ color: "#8b7355" }}>
                <div className="text-lg mb-1">🔒</div>
                <p>Private thoughts</p>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Empty state */}
      {!selectedPookieData && (
        <div 
          className="flex-1 flex items-center justify-center p-2"
          style={{ background: "#f7edd5" }}
        >
          <div className="text-center text-[12px]" style={{ color: "#8b7355" }}>
            <div className="text-lg mb-1">👻</div>
            <p>No pookie selected</p>
          </div>
        </div>
      )}
    </div>
  );
}
