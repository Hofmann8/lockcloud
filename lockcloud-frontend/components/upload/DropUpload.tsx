'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpFromLine } from 'lucide-react';
import type { ActivityKey } from '@/lib/api/types';
import { activityTypeLabel } from '@/lib/constants/activityTypes';
import { filesFromDrop } from '@/lib/dropFiles';
import { useStartUpload } from './useStartUpload';

/** 把文件拖到活动页上就传进这个活动 */
export function DropUpload({ activity, children }: { activity: ActivityKey; children: ReactNode }) {
  const { start, dialog } = useStartUpload();
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const startRef = useRef(start);
  const activityRef = useRef(activity);
  useEffect(() => {
    startRef.current = start;
    activityRef.current = activity;
  });

  useEffect(() => {
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current++;
      setOver(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setOver(false);
    };
    const overFn = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      void filesFromDrop(e.dataTransfer).then((files) => {
        if (files.length) void startRef.current(files.map((file) => ({ file })), activityRef.current);
      });
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', overFn);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', overFn);
      window.removeEventListener('drop', drop);
    };
  }, []);

  const name = activity.activity_name || activityTypeLabel(activity.activity_type);

  return (
    <>
      {children}
      {over && (
        <div className="pointer-events-none fixed inset-0 z-[150] flex items-center justify-center bg-bg/70 p-6 backdrop-blur-sm animate-fade">
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-accent bg-accent-soft/40">
            <ArrowUpFromLine className="h-8 w-8 text-accent-ink" />
            <p className="text-[17px] font-medium text-fg">松开以上传到「{name}」</p>
            <p className="text-[13px] text-fg-faint">{activity.activity_date}</p>
          </div>
        </div>
      )}
      {dialog}
    </>
  );
}
