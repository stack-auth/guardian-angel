"use client";

import { PixelDialog } from "./PixelDialog";
import { PixelButton } from "./PixelButton";

interface QRCodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  gameCode: string;
  gameUrl: string;
}

export function QRCodeDialog({
  isOpen,
  onClose,
  gameCode,
  gameUrl,
}: QRCodeDialogProps) {
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(gameUrl)}&bgcolor=1e293b&color=ffffff`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(gameUrl);
      alert("Link copied to clipboard!");
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = gameUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert("Link copied to clipboard!");
    }
  };

  return (
    <PixelDialog isOpen={isOpen} onClose={onClose} title="Share Game">
      <div className="flex flex-col items-center gap-3 sm:gap-4">
        {/* Game Code Display */}
        <div className="text-center">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">
            Game Code
          </p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">
            {gameCode}
          </p>
        </div>

        {/* QR Code */}
        <div className="bg-slate-800 p-3 sm:p-4 rounded-lg border-2 border-slate-600">
          <img
            src={qrCodeUrl}
            alt={`QR Code for game ${gameCode}`}
            className="w-32 h-32 sm:w-48 sm:h-48 pixel-art"
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        {/* Instructions */}
        <p className="text-slate-400 text-xs text-center">
          Scan this QR code or share the game code with friends to join!
        </p>

        {/* URL Display */}
        <div className="w-full bg-slate-800 p-2 sm:p-3 rounded border-2 border-slate-600">
          <p className="text-xs text-slate-400 break-all font-mono">{gameUrl}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 sm:gap-3 w-full">
          <PixelButton
            variant="primary"
            size="sm"
            onClick={copyToClipboard}
            className="flex-1"
          >
            Copy Link
          </PixelButton>
          <PixelButton
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="flex-1"
          >
            Close
          </PixelButton>
        </div>
      </div>
    </PixelDialog>
  );
}
