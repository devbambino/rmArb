import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  webpack: (config, { dev, isServer }) => {
    // Example: Suppress all warnings in development mode
    if (dev) {
      config.stats = {
        warnings: false,
      };
    }
    return config;
  },
};

export default nextConfig;
