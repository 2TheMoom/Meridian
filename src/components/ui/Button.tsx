"use client";

import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "border border-brass text-brass hover:bg-brass hover:text-ink",
  secondary: "border border-paper/20 text-paper hover:border-paper/40",
  danger: "bg-danger text-paper hover:bg-danger/90",
};

const SIZE_CLASSES: Record<ButtonVariant, Record<ButtonSize, string>> = {
  primary: { sm: "px-3 py-1.5 font-display text-xs", md: "px-4 py-2 font-display text-sm", lg: "px-5 py-2.5 font-display text-sm" },
  secondary: { sm: "px-3 py-1 font-body text-sm", md: "px-4 py-2 font-body text-sm", lg: "px-5 py-2.5 font-body text-sm" },
  danger: { sm: "px-3 py-1 font-display text-sm", md: "px-4 py-2 font-display text-sm", lg: "px-5 py-2.5 font-display text-sm" },
};

// The one place button styling is decided — every action in the app should
// render through this instead of hand-rolling its own Tailwind string,
// which is exactly how the app ended up with four different "primary
// button" treatments and two different border opacities on adjacent
// secondary buttons in the same card.
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={`${SIZE_CLASSES[variant][size]} ${VARIANT_CLASSES[variant]} transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
