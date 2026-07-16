import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0a1128",
        horizon: "#1c2b4a",
        amber: "#e8a33d",
        crimson: "#c23b3b",
      },
      fontFamily: {
        heading: ["var(--font-barlow-condensed)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
