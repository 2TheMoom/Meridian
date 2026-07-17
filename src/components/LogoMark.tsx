"use client";

import { useId } from "react";

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  const gradientId = useId();
  const lineExtend = size * 0.35;
  const width = size + lineExtend * 2;
  const cx = width / 2;
  const cy = size / 2;

  return (
    <svg
      width={width}
      height={size}
      viewBox={`0 0 ${width} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <line x1={0} y1={cy} x2={width} y2={cy} stroke="#8A8779" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={size / 2} fill={`url(#${gradientId})`} />
      <defs>
        <radialGradient id={gradientId} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#E8C97A" />
          <stop offset="100%" stopColor="#C89B4A" />
        </radialGradient>
      </defs>
    </svg>
  );
}
