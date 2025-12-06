"use client";

import { PixelDialog } from "./PixelDialog";
import { POOKIE_SYSTEM_PROMPT } from "../lib/gameConfig";

interface SystemPromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pookieName: string;
}

export function SystemPromptDialog({
  isOpen,
  onClose,
  pookieName,
}: SystemPromptDialogProps) {
  return (
    <PixelDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`${pookieName}'s Mind`}
      maxWidth="max-w-lg sm:max-w-2xl"
    >
      <div className="space-y-3 sm:space-y-4">
        <p className="text-slate-400 text-xs">
          This is how your pookie thinks and makes decisions. Understanding this
          will help you give better advice!
        </p>

        <div className="bg-slate-800 border-2 border-slate-600 p-3 sm:p-4 max-h-60 sm:max-h-80 overflow-y-auto scrollbar-thin">
          <pre className="text-emerald-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">
            {POOKIE_SYSTEM_PROMPT}
          </pre>
        </div>

        <div className="bg-amber-900/30 border border-amber-700 p-2 sm:p-3 rounded">
          <p className="text-amber-300 text-xs">
            <span className="font-bold">💡 Tip:</span> Your pookie will consider
            your advice, but they have their own personality and might not always
            follow your suggestions. Build trust over time!
          </p>
        </div>
      </div>
    </PixelDialog>
  );
}
