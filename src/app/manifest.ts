import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meridian",
    short_name: "Meridian",
    description:
      "The chain is too fast for a second thought. Meridian is that thought, running before you sign.",
    start_url: "/",
    display: "standalone",
    background_color: "#0C0F14",
    theme_color: "#0C0F14",
    // apple-icon.tsx isn't listed here on purpose: iOS reads it via the
    // <link rel="apple-touch-icon"> tag Next.js auto-generates (at a
    // content-hashed path stable per build, not a guessable filename), not
    // from this manifest — Android/Chrome are this array's actual audience.
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icon-512", type: "image/png", sizes: "512x512" },
    ],
  };
}
