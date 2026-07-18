import type { ReactNode } from "react";

type PanelAccent = "default" | "brass" | "left-brass" | "left-danger";
type PanelSize = "sm" | "md" | "lg";

const ACCENT_CLASSES: Record<PanelAccent, string> = {
  default: "border border-paper/10",
  brass: "border border-brass/40",
  "left-brass": "border-l-2 border-brass",
  "left-danger": "border-l-2 border-danger",
};

const SIZE_CLASSES: Record<PanelSize, string> = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

// The one place "a bordered content block" is decided. Before this, every
// screen invented its own combination of border opacity and padding (p-4,
// p-6, p-8, all meaning the same thing) — this is what actually caused that
// drift, not any single screen being wrong on its own.
export function Panel({
  as: Tag = "div",
  accent = "default",
  size = "md",
  className = "",
  children,
}: {
  as?: "div" | "label";
  accent?: PanelAccent;
  size?: PanelSize;
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={`bg-ink-raised ${ACCENT_CLASSES[accent]} ${SIZE_CLASSES[size]} ${className}`}>{children}</Tag>;
}
