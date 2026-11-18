import type { Metadata, Viewport } from 'next';
import { Fraunces, Geist, Geist_Mono, Noto_Serif_SC } from 'next/font/google';
import './globals.css';
import { Providers } from '@/lib/providers';
import { themeBootstrap } from '@/lib/theme';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// 只用在字标、活动日期大数字这些展示位
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  axes: ['SOFT', 'WONK', 'opsz'],
  style: ['normal', 'italic'],
});

const notoSerifSC = Noto_Serif_SC({
  variable: '--font-serif-sc',
  weight: ['500', '600'],
  preload: false,
  display: 'swap',
});

// 图标沿用原来那套，不要改
export const metadata: Metadata = {
  title: {
    default: 'LockCloud',
    template: '%s · LockCloud',
  },
  description: '浙江大学 DFM Locking 舞队 Funk & Love 的影像档案',
  icons: {
    icon: 'https://funkandlove-main.s3.bitiful.net/public/favicon.ico',
    apple: 'https://funkandlove-main.s3.bitiful.net/public/icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#161412' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${notoSerifSC.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
