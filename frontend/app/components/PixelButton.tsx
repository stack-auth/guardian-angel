"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
}

const variantStyles = {
  primary: {
    background: "linear-gradient(180deg, #7cb587 0%, #4a8c59 100%)",
    border: "3px solid #2d6b3d",
    color: "white",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 3px 3px 0 #1a4a28",
    textShadow: "1px 1px 0 #2d6b3d",
  },
  secondary: {
    background: "linear-gradient(180deg, #d9c49a 0%, #c4a86e 100%)",
    border: "3px solid #8b5e34",
    color: "#3d2814",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 3px 3px 0 #5c3d1e",
    textShadow: "none",
  },
  danger: {
    background: "linear-gradient(180deg, #ef4444 0%, #dc2626 100%)",
    border: "3px solid #991b1b",
    color: "white",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 3px 3px 0 #7f1d1d",
    textShadow: "1px 1px 0 #991b1b",
  },
};

export function PixelButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  style,
  ...props
}: PixelButtonProps) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-4 text-base",
  };

  return (
    <button
      className={`font-bold uppercase tracking-wider transition-all duration-100 rounded disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${className}`}
      disabled={disabled}
      style={{
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
