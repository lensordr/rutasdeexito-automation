/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff1f1",
          100: "#ffdede",
          200: "#ffc2c2",
          300: "#ff9898",
          400: "#ff5a5a",
          500: "#f21b1b",
          600: "#dc0d0d",
          700: "#b80909",
          800: "#8f0808",
          900: "#5c0404",
        },
        // Lighter charcoal/slate ramp (less black than the ReelForge app).
        ink: {
          900: "#1f2430",
          800: "#272d3a",
          700: "#323949",
          600: "#3e4659",
          500: "#4c5467",
          400: "#5c6479",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(220,13,13,0.25), 0 8px 24px rgba(0,0,0,0.25)",
      },
    },
  },
  plugins: [],
};
