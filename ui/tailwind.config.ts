import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        guardblue: "#0B5ED7",
        guardblueDark: "#084aab",
        guardnavy: "#0a1838",
        guardink: "#0f172a",
        guardcrimson: "#dc2626",
        guardamber: "#f59e0b",
        guardemerald: "#10b981",
        guardpanel: "#0b1220",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
