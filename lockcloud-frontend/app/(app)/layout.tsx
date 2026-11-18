import { Shell } from '@/components/shell/Shell';

// 整段都依赖登录态和地址栏参数，不做预渲染
export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
