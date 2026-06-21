/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          950: "#052e16",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "draw-check": "drawCheck 0.8s ease-in-out forwards",
        "zoom-reveal": "zoomReveal 0.5s ease-in-out forwards",
        "fade-in": "fadeIn 0.4s ease-in-out forwards",
        "slide-up": "slideUp 0.4s ease-out forwards",
        "pulse-green": "pulseGreen 2s ease-in-out infinite",
      },
      keyframes: {
        drawCheck: {
          "0%": { strokeDashoffset: "200" },
          "100%": { strokeDashoffset: "0" },
        },
        zoomReveal: {
          "0%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(20)", opacity: "0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseGreen: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(34, 197, 94, 0.4)" },
          "50%": { boxShadow: "0 0 0 12px rgba(34, 197, 94, 0)" },
        },
      },
    },
  },
  plugins: [],
};
