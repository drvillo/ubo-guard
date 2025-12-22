import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is default in Next.js 16, but we need webpack for WASM support
  // Use --webpack flag when building, or configure Turbopack if needed
};

export default nextConfig;
