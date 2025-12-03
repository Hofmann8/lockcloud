import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";

export const metadata: Metadata = {
  title: "LockCloud - Funk & Love 云存储",
  description: "浙江大学 DFM Locking 舞队私有云存储服务",
  icons: {
    icon: "https://funkandlove-main.s3.bitiful.net/public/favicon.ico",
    apple: "https://funkandlove-main.s3.bitiful.net/public/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        {/* 使用字节跳动CDN镜像加载Inter字体 */}
        <link
          rel="preconnect"
          href="https://lf9-cdn-tos.bytecdntp.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://lf9-cdn-tos.bytecdntp.com/cdn/expire-1-M/inter-ui/3.19.3/inter.min.css"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased font-sans">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
