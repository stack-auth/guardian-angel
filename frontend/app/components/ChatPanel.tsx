"use client";

import { useState, useRef } from "react";
import { PixelButton } from "./PixelButton";
import type { PookieThought } from "../types";
import { BACKEND_URL } from "../lib/gameConfig";

interface ChatPanelProps {
  worldId: string;
  pookieName: string;
  thoughts: PookieThought[];
  isCollapsed: boolean;
  onToggle: () => void;
}

export function ChatPanel({
  worldId,
  pookieName,
  thoughts,
  isCollapsed,
  onToggle,
}: ChatPanelProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const sendMessage = async () => {
    if (!message.trim() || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/worlds/${worldId}/pookies/${encodeURIComponent(pookieName)}/guardian-angel/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: message.trim() }),
        }
      );

      if (response.ok) {
        setMessage("");
      } else {
        console.error("Failed to send message");
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatThought = (thought: PookieThought) => {
    switch (thought.source) {
      case "self":
        return {
          icon: thought.spokenLoudly ? "💬" : "💭",
          label: thought.spokenLoudly ? "Said" : "Thought",
          text: thought.text,
          color: "text-blue-300",
          bg: "bg-blue-900/30",
        };
      case "guardian-angel":
        return {
          icon: "🪽",
          label: "You",
          text: thought.text,
          color: "text-emerald-300",
          bg: "bg-emerald-900/30",
        };
      case "facility":
        return {
          icon: "📍",
          label: "Facility",
          text: thought.text,
          color: "text-amber-300",
          bg: "bg-amber-900/30",
        };
      case "self-action-change":
        return {
          icon: "⚡",
          label: "Action",
          text: thought.text,
          color: "text-purple-300",
          bg: "bg-purple-900/30",
        };
      case "someone-else-said":
        return {
          icon: "👂",
          label: thought.sayerPookieName,
          text: thought.text,
          color: "text-pink-300",
          bg: "bg-pink-900/30",
        };
      case "trade-offer-received":
        return {
          icon: "📦",
          label: `Offer from ${thought.fromPookieName}`,
          text: `Offers ${thought.itemsOffered.map(i => `${i.amount}x ${i.itemId}`).join(', ')} for ${thought.itemsRequested.map(i => `${i.amount}x ${i.itemId}`).join(', ')}`,
          color: "text-cyan-300",
          bg: "bg-cyan-900/30",
        };
      case "trade-completed":
        return {
          icon: "✅",
          label: `Trade with ${thought.withPookieName}`,
          text: `Gave ${thought.itemsGiven.map(i => `${i.amount}x ${i.itemId}`).join(', ')}, got ${thought.itemsReceived.map(i => `${i.amount}x ${i.itemId}`).join(', ')}`,
          color: "text-green-300",
          bg: "bg-green-900/30",
        };
      case "trade-rejected":
        return {
          icon: "❌",
          label: "Trade Rejected",
          text: `${thought.byPookieName} rejected your offer`,
          color: "text-red-300",
          bg: "bg-red-900/30",
        };
      default:
        return {
          icon: "📝",
          label: "Event",
          text: "",
          color: "text-slate-300",
          bg: "bg-slate-900/30",
        };
    }
  };

  if (isCollapsed) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-2 right-2 sm:bottom-4 sm:right-4 z-40 bg-slate-900/90 border-2 border-slate-600 px-3 py-2 text-white font-bold hover:bg-slate-800 transition-colors text-xs sm:text-sm"
      >
        💬 Chat
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 sm:bottom-4 sm:right-4 z-40 w-full sm:w-80 max-h-[60vh] sm:max-h-96 flex flex-col bg-slate-900/95 border-t-2 sm:border-2 border-slate-600 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b-2 border-slate-600 bg-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-base sm:text-lg">🪽</span>
          <span className="text-white font-bold text-xs sm:text-sm truncate max-w-[150px]">{pookieName}</span>
        </div>
        <button
          onClick={onToggle}
          className="text-slate-400 hover:text-white text-sm p-1"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2 max-h-[40vh] sm:max-h-60 scrollbar-thin"
        style={{ scrollBehavior: 'smooth' }}
      >
        {thoughts.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-4">
            No messages yet. Send a suggestion to your pookie!
          </p>
        ) : (
          thoughts.slice(-20).map((thought, index) => {
            const formatted = formatThought(thought);
            return (
              <div
                key={index}
                className={`${formatted.bg} rounded px-2 py-1.5 border border-slate-700`}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-xs">{formatted.icon}</span>
                  <span className={`text-xs font-bold ${formatted.color} truncate max-w-[100px]`}>
                    {formatted.label}
                  </span>
                </div>
                <p className="text-white text-xs leading-relaxed wrap-break-word">
                  {formatted.text}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="border-t-2 border-slate-600 p-2 flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Give advice..."
          className="flex-1 bg-slate-800 border border-slate-600 px-2 py-2 sm:py-1.5 text-white text-sm sm:text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 rounded"
          disabled={isSending}
        />
        <PixelButton
          size="sm"
          onClick={sendMessage}
          disabled={!message.trim() || isSending}
          className="px-3 py-2 sm:px-2 sm:py-1"
        >
          {isSending ? "..." : "→"}
        </PixelButton>
      </div>
    </div>
  );
}
