'use client';

import { useState, useRef, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  ariaLabel?: string;
  /** 下拉菜单展开方向，默认 down；空间不足时会自动翻转 */
  placement?: 'down' | 'up';
}

interface MenuPos {
  top: number;       // 永远是 fixed top（基于视口）
  left: number;
  width: number;
  /** 'up' 时菜单底边对齐 top，需要 transform translateY(-100%) */
  placeUp: boolean;
  /** 实际能用的高度上限，避免菜单超出视口 */
  maxHeight: number;
}

const MENU_GAP = 4;
const ITEM_HEIGHT = 40;
const MENU_PADDING = 8;
const MENU_MAX_HEIGHT = 240;

// 自定义下拉。原生 <select> 在 Windows / 不同浏览器上箭头无法主题化，
// 这里用 button + Portal 浮层实现：
//   - 浮层渲染到 document.body，position: fixed，
//     脱离任何祖先 overflow 盒子 —— 不会撑大 modal 内容区的滚动高度。
//   - 跟随按钮位置滚动 / resize 时更新坐标，按钮被滚出视口外则自动收起。
export function Select({
  value,
  onChange,
  options,
  placeholder = '请选择',
  className = '',
  buttonClassName = '',
  size = 'md',
  disabled = false,
  ariaLabel,
  placement = 'down',
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const [highlight, setHighlight] = useState<number>(-1);
  const [mounted, setMounted] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  const current = options.find((o) => o.value === value);

  const computePos = useCallback((): MenuPos | null => {
    if (!buttonRef.current) return null;
    const rect = buttonRef.current.getBoundingClientRect();
    const desired = Math.min(options.length * ITEM_HEIGHT + MENU_PADDING, MENU_MAX_HEIGHT);
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
    const spaceAbove = rect.top - MENU_GAP;
    const placeUp = placement === 'up' || (spaceBelow < desired && spaceAbove > spaceBelow);
    const maxHeight = Math.max(
      80,
      Math.min(MENU_MAX_HEIGHT, placeUp ? spaceAbove : spaceBelow),
    );
    return {
      top: placeUp ? rect.top - MENU_GAP : rect.bottom + MENU_GAP,
      left: rect.left,
      width: rect.width,
      placeUp,
      maxHeight,
    };
  }, [options.length, placement]);

  // 打开 / 关闭时挂载视口监听并维护位置
  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    setMenuPos(computePos());

    const update = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      // 按钮整体被滚出视口外，直接收起 —— 避免菜单悬空。
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setOpen(false);
        return;
      }
      setMenuPos(computePos());
    };

    // capture: 监听任何祖先容器的滚动（modal 内 overflow-y-auto 也能触发）
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, computePos]);

  // 点外面 / Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // 打开时高亮当前值
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlight(idx >= 0 ? idx : 0);
    }
  }, [open, value, options]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (e.key === 'ArrowDown') {
        setHighlight((h) => (h + 1) % options.length);
      } else if (e.key === 'ArrowUp') {
        setHighlight((h) => (h - 1 + options.length) % options.length);
      } else if (e.key === 'Enter' || e.key === ' ') {
        const opt = options[highlight];
        if (opt) {
          onChange(opt.value);
          setOpen(false);
        }
      }
    }
  };

  const sizeStyles =
    size === 'sm'
      ? 'px-2.5 py-1.5 text-sm min-h-9'
      : 'px-3 py-2.5 text-base min-h-11';

  const menu = open && menuPos && mounted
    ? createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          style={{
            position: 'fixed',
            top: menuPos.top,
            left: menuPos.left,
            width: menuPos.width,
            maxHeight: menuPos.maxHeight,
            transform: menuPos.placeUp ? 'translateY(-100%)' : undefined,
            zIndex: 60,
          }}
          className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-y-auto custom-scrollbar animate-fade-in-down"
        >
          {options.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-400 text-center">暂无选项</div>
          ) : (
            options.map((opt, i) => {
              const isSelected = opt.value === value;
              const isHighlighted = i === highlight;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    buttonRef.current?.focus();
                  }}
                  className={`
                    w-full px-3 py-2.5 text-left text-sm flex items-center justify-between gap-2
                    transition-colors
                    ${isHighlighted ? 'bg-orange-50' : 'bg-white'}
                    ${isSelected ? 'text-orange-700 font-medium' : 'text-gray-700'}
                  `}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <svg
                      className="shrink-0 w-4 h-4 text-orange-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        className={`
          ${sizeStyles}
          w-full bg-white border rounded-lg
          flex items-center justify-between gap-2 text-left
          transition-all
          ${open
            ? 'border-orange-400 ring-2 ring-orange-500/30 outline-none'
            : 'border-gray-200 hover:border-gray-300'
          }
          ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'cursor-pointer'}
          ${buttonClassName}
        `}
      >
        <span className={`truncate ${current ? 'text-gray-900' : 'text-gray-400'}`}>
          {current?.label ?? placeholder}
        </span>
        <svg
          className={`shrink-0 w-4 h-4 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {menu}
    </div>
  );
}
