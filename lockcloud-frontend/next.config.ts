import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone: 把所需 node_modules 一并 tree-shake 出来,deploy.py 直接打包
  // .next/standalone + .next/static + public,服务器解压 `node server.js` 就能跑
  output: 'standalone',
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
