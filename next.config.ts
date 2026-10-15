import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // hide the Next.js dev-tools badge in the corner
  devIndicators: false,
};

export default nextConfig;
