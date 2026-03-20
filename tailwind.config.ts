import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "gm-deep":   "#0f0726",
        "gm-navy":   "#0a1628",
        "gm-pink":   "#FF8CA8",
        "gm-purple": "#a855f7",
      },
      backgroundImage: {
        "gm-gradient": "linear-gradient(135deg, #0f0726 0%, #0a1628 100%)",
        "gm-accent":   "linear-gradient(135deg, #FF8CA8, #a855f7)",
      },
    },
  },
  plugins: [],
};
export default config;
