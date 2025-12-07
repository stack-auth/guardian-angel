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
        <label 
          className="block text-sm font-bold mb-2 uppercase tracking-wider"
          style={{ color: "#3d2814" }}
        >
          {label}
        </label>
      )}
      <input
        className={`w-full px-4 py-3 rounded focus:outline-none ${className}`}
        style={{
          background: "#f7edd5",
          border: `2px solid ${error ? "#dc2626" : "#8b5e34"}`,
          color: "#3d2814",
          boxShadow: "inset 2px 2px 0 #d9c49a, 2px 2px 0 #5c3d1e",
        }}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs" style={{ color: "#dc2626" }}>{error}</p>
      )}
    </div>
  );
}
