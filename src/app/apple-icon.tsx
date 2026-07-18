import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <svg width="180" height="180" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" fill="#0C0F14" />
        <line x1="6" y1="32" x2="58" y2="32" stroke="#8A8779" strokeWidth="1.75" />
        <circle cx="32" cy="32" r="17" fill="url(#g)" />
        <defs>
          <radialGradient id="g" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#E8C97A" />
            <stop offset="100%" stopColor="#C89B4A" />
          </radialGradient>
        </defs>
      </svg>
    ),
    { ...size },
  );
}
