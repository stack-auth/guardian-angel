"use client";

import { InputHTMLAttributes } from "react";

interface PixelInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function PixelInput({
  label,
  error,
  className = "",
  ...props
}: PixelInputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-white text-sm font-bold mb-2 uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        className={`pixel-input w-full px-4 py-3 bg-slate-800 border-2 border-slate-600 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none ${error ? "border-red-500" : ""
          } ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-red-400 text-xs">{error}</p>
      )}
    </div>
  );
}
