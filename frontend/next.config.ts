import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fix trailing slash issues for better routing
  trailingSlash: false,
  
  // Ensure we can access all routes
  async redirects() {
    return []
  }
};

export default nextConfig;
