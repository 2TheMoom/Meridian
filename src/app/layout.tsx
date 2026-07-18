import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// A distinct type system: a warm editorial serif for display type, a plain
// grotesk for body copy, a technical mono for instrument-style data.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

const TAGLINE = "The chain is too fast for a second thought. Meridian is that thought, running before you sign.";

export const metadata: Metadata = {
  // Falls back to localhost so opengraph-image/other absolute-URL metadata
  // still resolve correctly in dev — set MERIDIAN_APP_URL once there's a
  // real deployed domain and this picks it up automatically.
  metadataBase: new URL(process.env.MERIDIAN_APP_URL ?? "http://localhost:3000"),
  title: "Meridian",
  description: TAGLINE,
  openGraph: {
    title: "Meridian",
    description: TAGLINE,
    type: "website",
    siteName: "Meridian",
  },
  twitter: {
    card: "summary_large_image",
    title: "Meridian",
    description: TAGLINE,
  },
};

export const viewport: Viewport = {
  themeColor: "#0C0F14",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
