import type { Config } from "tailwindcss";

// Colours are defined as CSS variables in app/globals.css and mapped here, so a
// palette change is one file and never a find-and-replace across components.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: "var(--pitch)",
        grass: "var(--grass)",
        lime: "var(--lime)",
        paper: "var(--paper)",
        sheet: "var(--sheet)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        hover: "var(--hover)",
        overdue: "var(--overdue)",
        soon: "var(--soon)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
