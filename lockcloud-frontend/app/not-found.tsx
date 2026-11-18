import { ButtonLink } from '@/components/ui/Button';
import { LuckyLocker } from '@/components/brand/LuckyLocker';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <LuckyLocker size={140} />
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-faint">404</p>
      <h1 className="mt-2 font-serif text-[24px] font-semibold text-fg">页面不存在</h1>
      <p className="mt-2 max-w-sm text-[14px] text-fg-soft">链接可能有误，或内容已被移除。</p>
      <ButtonLink href="/" variant="primary" className="mt-7">返回资料库</ButtonLink>
    </div>
  );
}
