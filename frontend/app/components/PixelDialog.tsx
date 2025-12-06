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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className={`pixel-dialog relative ${maxWidth} w-full max-h-[90vh] overflow-auto bg-slate-900 border-2 sm:border-4 border-slate-600 shadow-2xl`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b-2 border-slate-600 bg-slate-800 sticky top-0">
          <h2 className="text-white font-bold uppercase tracking-wider text-xs sm:text-sm truncate pr-2">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-lg sm:text-xl leading-none p-1"
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
