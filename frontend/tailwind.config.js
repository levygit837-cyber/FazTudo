/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Satoshi",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        display: [
          "Cabinet Grotesk",
          "Satoshi",
          "sans-serif",
        ],
        mono: [
          "DM Mono",
          "JetBrains Mono",
          "Fira Code",
          "monospace",
        ],
      },
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        secondary: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        slate: {
          950: "#020617",
        },
        success: "#10b981",
        warning: "#f59e0b",
        error: "#ef4444",
        info: "#3b82f6",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        "glow-blue": "0 0 20px rgba(37, 99, 235, 0.15)",
        "glow-blue-md": "0 0 30px rgba(37, 99, 235, 0.2)",
        "glow-blue-lg": "0 0 40px rgba(37, 99, 235, 0.3)",
        "glow-green": "0 0 20px rgba(16, 185, 129, 0.15)",
        "glow-amber": "0 0 20px rgba(245, 158, 11, 0.15)",
      },
      backdropBlur: {
        xs: "2px",
        "2xl": "40px",
        "3xl": "64px",
      },
      animation: {
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-up": "slide-up 0.5s ease-out",
        shimmer: "shimmer 2s linear infinite",
        "count-up": "count-up 0.8s ease-out",
        "draw-in": "draw-in 1.2s ease-out forwards",
        "ring-fill": "ring-fill 1s ease-out forwards",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-in-left": "slide-in-left 0.35s ease-out",
        "step-complete": "step-complete 0.4s ease-out",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 20px rgba(37, 99, 235, 0.15)",
          },
          "50%": {
            boxShadow: "0 0 30px rgba(37, 99, 235, 0.3)",
          },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "count-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "draw-in": {
          from: { strokeDashoffset: "1" },
          to: { strokeDashoffset: "0" },
        },
        "ring-fill": {
          from: { strokeDashoffset: "251.2" },
          to: { strokeDashoffset: "var(--ring-target)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-30px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "step-complete": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.2)" },
          "100%": { transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
