import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Cloudinary (production cover images)
      { protocol: "https", hostname: "res.cloudinary.com" },
      // Allow any HTTPS host for development/testing with URL input
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
