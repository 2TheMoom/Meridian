import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // A night-watch palette: dark ink, warm chart-paper ivory, brass
        // instrument accent, and port/starboard navigation-light colors
        // (red/green) doing double duty as danger/positive signals.
        ink: "#0C0F14",
        "ink-raised": "#151A22",
        paper: "#EDE7DA",
        dim: "#8A8779",
        brass: "#C89B4A",
        signal: "#5B8C6E",
        danger: "#B5453B",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-inter)", "sans-serif"],
        technical: ["var(--font-plex-mono)", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
