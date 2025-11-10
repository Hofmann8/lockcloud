import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

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
      <body className={`${inter.variable} antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
