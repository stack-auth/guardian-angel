"use client";

import { ReactNode, useEffect } from "react";

interface PixelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

export function PixelDialog({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-md",
}: PixelDialogProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop - warm sepia tint */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: "rgba(61, 40, 20, 0.8)" }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className={`relative ${maxWidth} w-full max-h-[90vh] overflow-auto rounded-lg`}
        style={{
          background: "linear-gradient(180deg, #f7edd5 0%, #ebd9b4 100%)",
          border: "4px solid #8b5e34",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.5), 8px 8px 0 #5c3d1e",
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 sticky top-0"
          style={{
            borderBottom: "3px solid #a67c52",
            background: "linear-gradient(180deg, #ebd9b4 0%, #d9c49a 100%)",
          }}
        >
          <h2 
            className="font-bold uppercase tracking-wider text-xs sm:text-sm truncate pr-2"
            style={{ color: "#3d2814" }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-lg sm:text-xl leading-none p-1 rounded transition-colors"
            style={{ color: "#8b5e34" }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4">{children}</div>
      </div>
    </div>
  );
}
