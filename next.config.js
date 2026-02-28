/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.fal.run" },
      { protocol: "https", hostname: "**.fal.media" },
      { protocol: "https", hostname: "replicate.delivery" },
      { protocol: "https", hostname: "pbxt.replicate.delivery" },
    ],
  },
  // Для native модулей в server components (правильное название)
  serverComponentsExternalPackages: ["better-sqlite3"],
};

module.exports = nextConfig;