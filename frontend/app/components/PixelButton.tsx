"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
}

export function PixelButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  ...props
}: PixelButtonProps) {
  const baseClasses =
    "pixel-button font-bold uppercase tracking-wider transition-all duration-100 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0";

  const variantClasses = {
    primary: "bg-emerald-500 hover:bg-emerald-400 text-white border-emerald-700",
    secondary: "bg-slate-600 hover:bg-slate-500 text-white border-slate-800",
    danger: "bg-red-500 hover:bg-red-400 text-white border-red-700",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-4 text-base",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
