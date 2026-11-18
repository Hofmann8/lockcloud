'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Link2,
  MoreHorizontal,
  PencilLine,
  ScanFace,
  Trash2,
  X,
} from 'lucide-react';
import { cn, isTyping } from '@/lib/cn';
import { IconButton } from '@/components/ui/Button';
import { Confirm } from '@/components/ui/Dialog';
import { MenuItem, MenuSeparator, Popover } from '@/components/ui/Popover';
import { Sheet } from '@/components/ui/Sheet';
import { Tooltip } from '@/components/ui/Tooltip';
import { toast } from '@/components/ui/Toast';
import { PauseMark } from '@/components/brand/PauseMark';
import { Player, type PlayerHandle } from '@/components/player/Player';
import { useFileActions, useRefreshLibrary } from '@/components/files/useFileActions';
import { FileEditDialog } from '@/components/files/FileEditDialog';
import { filesApi } from '@/lib/api/files';
import { commentsApi, mediaApi, peopleApi } from '@/lib/api/media';
import type { FileItem } from '@/lib/api/types';
import { uprightBox } from '@/lib/faces';
import { formatTimecode } from '@/lib/format';
import { useMediaQuery } from '@/lib/hooks';
import { canEdit } from '@/lib/permissions';
import { activityHref } from '@/lib/routes';
import { displayName, isAudio, isImage, isVideo, prefetchUrls, previewStyle } from '@/lib/urls';
import { LivePhoto } from './LivePhoto';
import { useAuthStore } from '@/stores/authStore';
import { useUi } from '@/stores/uiStore';
import { AnalyzeDialog } from '@/components/lockai/LockAI';
import { ImageViewer, type Overlay } from './ImageViewer';
import { InfoPanel } from './InfoPanel';

interface FileViewerProps {
  fileId: number;
  initial?: FileItem;
  onClose: () => void;
  onPrev?: (() => void) | null;
  onNext?: (() => void) | null;
  prevId?: number | null;
  nextId?: number | null;
  /** 第几个 / 一共几个 */
  position?: { index: number; total: number | null };
  /** 从搜索结果、评论点进来时跳到的秒数 */
  startAt?: number | null;
  mode?: 'overlay' | 'page';
}

export function FileViewer({ fileId, initial, onClose, onPrev, onNext, prevId, nextId, position, startAt, mode = 'overlay' }: FileViewerProps) {
  const user = useAuthStore((s) => s.user);
  const infoOpen = useUi((s) => s.infoOpen);
  const setInfoOpen = useUi((s) => s.setInfoOpen);
  const wide = useMediaQuery('(min-width: 1024px)');
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTime, setMenuTime] = useState(0);
  const [showFaces, setShowFaces] = useState(false);
  const [hoverPerson, setHoverPerson] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const menuAnchor = useRef<HTMLButtonElement>(null);
  const player = useRef<PlayerHandle | null>(null);
  const timeRef = useRef(0);
  const { trash, download } = useFileActions();

  const fileQuery = useQuery({
    queryKey: ['file', fileId],
    queryFn: () => filesApi.get(fileId),
    initialData: initial,
    initialDataUpdatedAt: 0,
  });
  const file = fileQuery.data;
  const video = file ? isVideo(file) : false;
  const image = file ? isImage(file) : false;
  const audio = file ? isAudio(file) : false;
  // 视频、音频进播放器；音频没有画面，可以按时刻评论、复制带时刻的链接，和视频一样
  const playable = video || audio;

  const qc = useQueryClient();
  const refreshLibrary = useRefreshLibrary();
  const media = useQuery({
    queryKey: ['media', fileId],
    queryFn: () => mediaApi.detail(fileId),
    // 图片只有 Live Photo 要（动态部分的播放地址）
    enabled: playable || (image && !!file?.live),
    staleTime: 30 * 60 * 1000,
    // LockAI 排队、分析中：隔一会儿看一眼，分析完播放器自动出节拍器和分段
    refetchInterval: (q) => (['queued', 'processing'].includes(q.state.data?.lockai?.status ?? '') ? 8_000 : false),
    refetchIntervalInBackground: true,
  });
  // 分析状态变了（排队 → 分析中 → 完成 / 失败）：文件信息、网格上的 AI 角标、人物和搜索跟着刷新
  const lockaiStatus = media.data?.lockai?.status ?? null;
  const lastLockaiStatus = useRef(lockaiStatus);
  useEffect(() => {
    const before = lastLockaiStatus.current;
    lastLockaiStatus.current = lockaiStatus;
    if (before === lockaiStatus || before === null) return;
    qc.setQueryData<FileItem>(['file', fileId], (f) => (f ? { ...f, lockai_status: lockaiStatus } : f));
    if (lockaiStatus === 'ready' || lockaiStatus === 'failed') refreshLibrary();
  }, [lockaiStatus, fileId, qc, refreshLibrary]);

  const people = useQuery({
    queryKey: ['people-in-file', fileId],
    queryFn: () => peopleApi.inFile(fileId),
    enabled: image,
    meta: { silent: true },
  });

  const comments = useQuery({
    queryKey: ['comments', fileId],
    queryFn: () => commentsApi.list(fileId),
    enabled: !!file,
    meta: { silent: true },
  });

  // 左右两张的大图先要着
  useEffect(() => {
    const ids = [prevId, nextId].filter((x): x is number => !!x);
    if (ids.length) prefetchUrls(ids, previewStyle());
  }, [prevId, nextId]);

  const toggleInfo = useCallback(() => {
    if (wide) setInfoOpen(!useUi.getState().infoOpen);
    else setSheet((v) => !v);
  }, [wide, setInfoOpen]);

  // 键盘：Esc 关，Shift+←/→ 换文件（图片直接 ←/→），I 信息栏
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (e.key === 'Escape') {
        if (zoomed) return;
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft' && (e.shiftKey || !playable) && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === 'ArrowRight' && (e.shiftKey || !playable) && onNext) {
        e.preventDefault();
        onNext();
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        toggleInfo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext, playable, zoomed, toggleInfo]);

  const overlays = useMemo<Overlay[]>(() => {
    const data = people.data;
    if (!data?.file_dims) return [];
    return data.people
      .filter((p) => p.best_face_in_file && (showFaces || hoverPerson === p.id))
      .map((p) => ({
        key: p.id,
        rect: uprightBox(p.best_face_in_file!.bbox, data.file_dims!),
        label: p.name || '未命名',
        active: hoverPerson === p.id,
      }));
  }, [people.data, showFaces, hoverPerson]);

  const markers = useMemo(
    () => (comments.data ?? []).filter((c) => c.t != null).map((c) => ({ key: c.id, t: c.t!, label: c.body })),
    [comments.data],
  );

  const seekTo = useCallback((t: number) => {
    player.current?.seek(t);
    player.current?.play();
  }, []);

  if (!file) {
    return (
      <div className="stage dark fixed inset-0 z-[200] flex items-center justify-center bg-stage">
        {fileQuery.isError ? (
          <div className="text-center">
            <p className="text-sm text-stage-soft">文件不存在或已被删除</p>
            <button type="button" onClick={onClose} className="mt-4 text-sm text-stage-accent">返回</button>
          </div>
        ) : (
          <PauseMark size={32} state="busy" className="text-white" />
        )}
      </div>
    );
  }

  const editable = canEdit(file, user);
  const panel = (
    <InfoPanel
      file={file}
      editable={editable}
      lockai={video ? media.data?.lockai ?? null : undefined}
      onAnalyze={() => setAnalyzing(true)}
      people={people.data}
      onHoverPerson={setHoverPerson}
      comments={comments.data ?? []}
      getTime={playable ? () => timeRef.current : undefined}
      onSeek={playable ? seekTo : undefined}
      onEdit={() => setEditing(true)}
    />
  );

  const showPanel = wide && infoOpen;

  return (
    <div
      className={cn(
        'stage dark flex bg-stage text-stage-fg',
        'fixed inset-0 z-[200]',
        mode === 'overlay' && 'animate-fade',
      )}
      role={mode === 'overlay' ? 'dialog' : undefined}
      aria-label={displayName(file)}
    >
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* 顶栏 */}
        <div className="absolute inset-x-0 top-0 z-10 flex h-14 items-center gap-2 bg-gradient-to-b from-black/70 to-transparent px-2 pt-[env(safe-area-inset-top)] sm:px-3">
          <IconButton tone="stage" label={mode === 'page' ? '返回' : '关闭'} onClick={onClose}>
            {mode === 'page' ? <ArrowLeft className="h-5 w-5" /> : <X className="h-5 w-5" />}
          </IconButton>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-stage-fg">{displayName(file)}</p>
            <p className="truncate text-[11.5px] text-stage-faint">
              {file.activity_date && (
                <Link href={activityHref({ activity_date: file.activity_date, activity_type: file.activity_type ?? '', activity_name: file.activity_name ?? '' })} className="hover:text-stage-soft">
                  {file.activity_name || file.activity_type_display || '未分类'}
                </Link>
              )}
              {position && position.total ? <span className="tabular"> · {position.index + 1} / {position.total}</span> : null}
            </p>
          </div>
          {image && (people.data?.people.length ?? 0) > 0 && (
            <IconButton tone="stage" label={showFaces ? '隐藏人物标记' : '显示人物标记'} active={showFaces} onClick={() => setShowFaces((v) => !v)}>
              <ScanFace className="h-[18px] w-[18px]" />
            </IconButton>
          )}
          <IconButton tone="stage" label="下载" onClick={() => download([file], displayName(file))}>
            <Download className="h-[18px] w-[18px]" />
          </IconButton>
          <Tooltip label="信息" shortcut="I" side="bottom">
            <IconButton tone="stage" label="信息" active={wide ? infoOpen : sheet} onClick={toggleInfo}>
              <Info className="h-[18px] w-[18px]" />
            </IconButton>
          </Tooltip>
          <IconButton
            ref={menuAnchor}
            tone="stage"
            label="更多"
            onClick={() => {
              setMenuTime(timeRef.current);
              setMenuOpen((v) => !v);
            }}
          >
            <MoreHorizontal className="h-5 w-5" />
          </IconButton>
          <Popover open={menuOpen} onOpenChange={setMenuOpen} anchor={menuAnchor} placement="bottom-end" tone="stage" className="w-52">
            <MenuItem
              icon={<PencilLine className="h-4 w-4" />}
              label={editable ? '编辑信息' : '申请编辑'}
              onSelect={() => {
                setMenuOpen(false);
                setEditing(true);
              }}
            />
            <MenuItem
              icon={<Link2 className="h-4 w-4" />}
              label={playable && menuTime > 1 ? `复制链接（从 ${formatTimecode(menuTime)} 开始）` : '复制链接'}
              onSelect={async () => {
                setMenuOpen(false);
                const t = playable && menuTime > 1 ? `?t=${Math.floor(menuTime)}` : '';
                await navigator.clipboard.writeText(`${window.location.origin}/f/${file.id}${t}`);
                toast('已复制链接');
              }}
            />
            <MenuSeparator />
            <MenuItem
              icon={<Trash2 className="h-4 w-4" />}
              label={editable ? '移到回收站' : '申请删除'}
              danger
              onSelect={() => {
                setMenuOpen(false);
                setConfirmTrash(true);
              }}
            />
          </Popover>
        </div>

        {/* 内容 */}
        <div className="relative min-h-0 flex-1">
          {playable ? (
            media.data ? (
              <Player
                key={file.id}
                fileId={file.id}
                media={media.data}
                onAnalyze={video ? () => setAnalyzing(true) : undefined}
                markers={markers}
                startAt={startAt}
                onTime={(t) => {
                  timeRef.current = t;
                }}
                onReady={(h) => {
                  player.current = h;
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <PauseMark size={30} state="busy" className="text-white" />
              </div>
            )
          ) : image ? (
            <>
              <ImageViewer
                file={file}
                overlays={overlays}
                onZoomChange={setZoomed}
                onSwipe={(dir) => {
                  if (dir === 'next') onNext?.();
                  else if (dir === 'prev') onPrev?.();
                  else if (mode === 'overlay') onClose();
                }}
              />
              {media.data?.live && !zoomed && <LivePhoto key={file.id} live={media.data.live} />}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-stage-soft">
              <p className="text-sm">此文件无法预览</p>
              <button type="button" onClick={() => download([file], displayName(file))} className="text-sm text-stage-accent">
                下载
              </button>
            </div>
          )}

          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              aria-label="上一个"
              className="absolute left-2 top-1/2 hidden h-12 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white md:flex"
            >
              <ChevronLeft className="h-7 w-7" strokeWidth={1.6} />
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              aria-label="下一个"
              className="absolute right-2 top-1/2 hidden h-12 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white md:flex"
            >
              <ChevronRight className="h-7 w-7" strokeWidth={1.6} />
            </button>
          )}
        </div>
      </div>

      {showPanel && (
        <aside className="w-[360px] shrink-0 overflow-y-auto border-l border-line bg-bg text-fg thin-scrollbar animate-fade">{panel}</aside>
      )}
      {!wide && (
        <Sheet open={sheet} onClose={() => setSheet(false)} className="dark text-fg">
          {panel}
        </Sheet>
      )}

      <FileEditDialog open={editing} onClose={() => setEditing(false)} file={file} editable={editable} />
      {video && <AnalyzeDialog file={file} open={analyzing} onClose={() => setAnalyzing(false)} />}
      <Confirm
        open={confirmTrash}
        onClose={() => setConfirmTrash(false)}
        title={editable ? '移到回收站？' : '申请删除？'}
        description={editable ? '30 天内可从回收站恢复。' : '此文件由他人上传，将向上传者发送删除申请。'}
        confirmLabel={editable ? '移到回收站' : '发送申请'}
        danger
        onConfirm={async () => {
          setConfirmTrash(false);
          const { moved } = await trash([file]);
          if (moved) {
            if (onNext) onNext();
            else if (onPrev) onPrev();
            else onClose();
          }
        }}
      />
    </div>
  );
}
