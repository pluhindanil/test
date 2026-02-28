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
          950: "#0a0a0f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
