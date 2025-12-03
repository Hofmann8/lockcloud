import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'funkandlove-cloud2.s3.bitiful.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's3.bitiful.net',
        pathname: '/**',
      },
    ],
    qualities: [75, 85, 90],
  },
};

export default nextConfig;
