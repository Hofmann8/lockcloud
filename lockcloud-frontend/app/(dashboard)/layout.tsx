import { DashboardClient } from './DashboardClient';

// 整个 dashboard 段都依赖登录态,Sidebar 用 useSearchParams,Next 16 + Turbopack
// 在 SSG 链路上不认 Suspense 包裹。这里 server 层直接标 dynamic 跳 prerender。
export const dynamic = 'force-dynamic';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardClient>{children}</DashboardClient>;
}
