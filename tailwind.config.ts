import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          950: "#05050e",
          900: "#0c0c1d",
          850: "#0f0f22",
          800: "#111128",
        },
      },
    },
  },
  plugins: [],
};

export default config;
