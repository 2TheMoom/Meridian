import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          backgroundColor: "#0C0F14",
          padding: "80px",
          border: "1px solid rgba(237,231,218,0.12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <svg width="72" height="72" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <line x1="6" y1="32" x2="58" y2="32" stroke="#8A8779" strokeWidth="1.75" />
            <circle cx="32" cy="32" r="17" fill="url(#g)" />
            <defs>
              <radialGradient id="g" cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor="#E8C97A" />
                <stop offset="100%" stopColor="#C89B4A" />
              </radialGradient>
            </defs>
          </svg>
          <span style={{ fontSize: "64px", fontStyle: "italic", color: "#EDE7DA", fontFamily: "serif" }}>
            Meridian
          </span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "40px",
            maxWidth: "820px",
            fontSize: "34px",
            lineHeight: 1.35,
            color: "#EDE7DA",
            fontFamily: "serif",
          }}
        >
          The chain is too fast for a second thought. Meridian is that thought, running before you sign.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "48px",
            fontSize: "20px",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "#C89B4A",
            fontFamily: "monospace",
          }}
        >
          Guard · Horizon · Oracle · Keel — Monad
        </div>
      </div>
    ),
    { ...size },
  );
}
