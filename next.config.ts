import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Allow production checks alongside a running local development server.
  distDir: process.env.ARES_BUILD_DIR || ".next",
};

export default nextConfig;
