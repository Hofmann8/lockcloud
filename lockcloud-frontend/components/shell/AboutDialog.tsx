'use client';

import { SITE } from '@/lib/site';
import { Dialog } from '@/components/ui/Dialog';
import { PauseMark, Wordmark } from '@/components/brand/PauseMark';

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="关于" className="max-w-sm">
      <div className="flex flex-col items-center px-6 pb-6 pt-2 text-center">
        <PauseMark size={44} />
        <Wordmark className="mt-3 text-[22px]" />
        {SITE.version && <p className="tabular mt-1.5 text-xs text-fg-faint">版本 {SITE.version}</p>}
        <p className="mt-3 text-[13px] text-fg-soft">仅供社团内部使用，请合理使用存储空间。</p>

        <dl className="mt-6 w-full divide-y divide-line rounded-xl border border-line text-[13px]">
          <div className="flex items-center justify-between px-4 py-2.5">
            <dt className="text-fg-faint">建设者</dt>
            <dd className="font-medium text-fg">{SITE.builders.join('、')}</dd>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <dt className="text-fg-faint">源代码</dt>
            <dd>
              <a
                href={SITE.github}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-fg transition-colors hover:text-accent-ink"
              >
                <GitHubMark className="h-3.5 w-3.5" />
                GitHub
              </a>
            </dd>
          </div>
        </dl>

        <p className="mt-5 text-[11px] text-fg-faint">© {new Date().getFullYear()} {SITE.owner}. All rights reserved.</p>
      </div>
    </Dialog>
  );
}
