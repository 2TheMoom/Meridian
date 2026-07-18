import { ImageResponse } from "next/og";

// A plain route, not the reserved `icon.tsx` convention — this doesn't need
// to auto-inject a <link rel="icon">, it exists only so manifest.ts's PWA
// icons array has a real 512x512 to point at (Android's "add to home
// screen" wants one; apple-icon.tsx's 180x180 alone isn't enough).
export async function GET() {
  const image = new ImageResponse(
    (
      <svg width="512" height="512" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
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
    { width: 512, height: 512 },
  );
  return new Response(image.body, { headers: { "Content-Type": "image/png" } });
}
