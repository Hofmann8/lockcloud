import type { NextConfig } from 'next';
import pkg from './package.json';

const nextConfig: NextConfig = {
  // 版本号只在 package.json 里改，「关于」里显示的从这里来
  env: { APP_VERSION: pkg.version },
  // standalone: 把所需 node_modules 一并 tree-shake 出来,deploy.py 直接打包
  // .next/standalone + .next/static + public,服务器解压 `node server.js` 就能跑
  output: 'standalone',
  images: {
    // 图片都是签名地址直出，不走 next/image 优化；动作小人是本地 GIF，也不优化
    unoptimized: true,
  },
  // 旧前端的地址，分享出去的链接还能打开
  async redirects() {
    return [
      { source: '/files', destination: '/', permanent: false },
      { source: '/files/:id(\\d+)', destination: '/f/:id', permanent: false },
      { source: '/persons', destination: '/people', permanent: false },
      { source: '/changelog', destination: '/', permanent: false },
    ];
  },
};

export default nextConfig;
