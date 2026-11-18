import { create } from 'zustand';

interface SelectionState {
  /** 选中的文件 id，保持选择顺序 */
  ids: number[];
  /** Shift 连选的起点 */
  anchor: number | null;
  /** 选中集合属于哪个视图，切页面时自动清掉 */
  scope: string | null;

  toggle: (id: number, scope: string) => void;
  selectRange: (orderedIds: number[], to: number, scope: string) => void;
  setAll: (ids: number[], scope: string) => void;
  clear: () => void;
}

export const useSelection = create<SelectionState>()((set, get) => ({
  ids: [],
  anchor: null,
  scope: null,

  toggle: (id, scope) => {
    const s = get();
    const base = s.scope === scope ? s.ids : [];
    const has = base.includes(id);
    set({ ids: has ? base.filter((x) => x !== id) : [...base, id], anchor: id, scope });
  },

  selectRange: (ordered, to, scope) => {
    const s = get();
    const from = s.scope === scope && s.anchor != null ? s.anchor : to;
    const a = ordered.indexOf(from);
    const b = ordered.indexOf(to);
    if (a < 0 || b < 0) {
      get().toggle(to, scope);
      return;
    }
    const range = ordered.slice(Math.min(a, b), Math.max(a, b) + 1);
    const base = s.scope === scope ? s.ids : [];
    set({ ids: [...base, ...range.filter((x) => !base.includes(x))], scope });
  },

  setAll: (ids, scope) => set({ ids, scope, anchor: null }),
  clear: () => set({ ids: [], anchor: null, scope: null }),
}));
