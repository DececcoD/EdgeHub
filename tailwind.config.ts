import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0B1220",
          900: "#121A2B",
          800: "#1B2740",
          700: "#26365A",
          muted: "#93A1BD"
        },
        paper: {
          0: "#FFFFFF",
          50: "#F6F7FB",
          200: "#E3E7F0",
          muted: "#5B6478"
        },
        // DEFAULT/soft stay at their original, vibrant values - used only
        // for decorative fills (the freshness-pulse dot, tick-flash,
        // button/badge backgrounds) where WCAG's text-contrast thresholds
        // don't apply. `text` is a separate, darker value for when the
        // color is the actual text content, not a background - the
        // vibrant DEFAULTs measure well under 4.5:1 as text against white
        // or their own `soft` background (verified: signal 2.00, caution
        // 2.04, risk 3.67, info 3.82 vs white - all fail AA normal text).
        // Every `text-{signal,caution,risk,info}` class in the app was
        // updated to `text-{...}-text` for this reason (Section 14 QA pass).
        signal: {
          DEFAULT: "#35D07F",
          soft: "#E4F9EE",
          text: "#1E7F4C" // 5.01:1 vs white, 4.55:1 vs signal-soft
        },
        caution: {
          DEFAULT: "#F5A524",
          soft: "#FDF3E1",
          text: "#9D6307" // 4.97:1 vs white, 4.52:1 vs caution-soft
        },
        risk: {
          DEFAULT: "#E4573D",
          soft: "#FBE7E2",
          text: "#C3351B" // 5.46:1 vs white, 4.58:1 vs risk-soft
        },
        info: {
          DEFAULT: "#4C7DF0",
          soft: "#E7EDFC",
          text: "#2460ED" // 5.29:1 vs white, 4.51:1 vs info-soft
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-data)", "ui-monospace", "monospace"]
      },
      borderRadius: {
        xs: "3px"
      },
      keyframes: {
        "pulse-current": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" }
        },
        "pulse-aging": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" }
        },
        "tick-up": {
          "0%": { backgroundColor: "rgba(53,208,127,0.35)" },
          "100%": { backgroundColor: "transparent" }
        },
        "tick-down": {
          "0%": { backgroundColor: "rgba(228,87,61,0.35)" },
          "100%": { backgroundColor: "transparent" }
        }
      },
      animation: {
        "pulse-current": "pulse-current 2.2s ease-in-out infinite",
        "pulse-aging": "pulse-aging 1.3s ease-in-out infinite",
        "tick-up": "tick-up 900ms ease-out",
        "tick-down": "tick-down 900ms ease-out"
      }
    }
  },
  plugins: []
};

export default config;
