import {
  ArrowUpFromLine,
  Gauge,
  GalleryVerticalEnd,
  Inbox,
  Search,
  Trash2,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 当前路径以这些开头时也算选中 */
  match?: string[];
  adminOnly?: boolean;
  shortcut?: string;
}

export const NAV: NavItem[] = [
  { href: '/', label: '资料库', icon: GalleryVerticalEnd, match: ['/activity', '/f/', '/compare'], shortcut: 'G L' },
  { href: '/search', label: '搜索', icon: Search, shortcut: '/' },
  { href: '/people', label: '人物', icon: UsersRound, shortcut: 'G P' },
  { href: '/upload', label: '上传', icon: ArrowUpFromLine, shortcut: 'U' },
  { href: '/requests', label: '申请', icon: Inbox },
  { href: '/trash', label: '回收站', icon: Trash2 },
  { href: '/admin', label: '管理', icon: Gauge, adminOnly: true },
];

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === '/') return pathname === '/' || !!item.match?.some((m) => pathname.startsWith(m));
  return pathname === item.href || pathname.startsWith(`${item.href}/`) || !!item.match?.some((m) => pathname.startsWith(m));
}
