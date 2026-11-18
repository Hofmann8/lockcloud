import { get, put } from './client';

// 节拍标注试验（只在本地用，/lab/beats）。后端见 routers/beat_lab.py。

/** one 这拍是"1"；cut 这里换歌或剪辑；off 拍点没踩在拍上；note 备注 */
export type MarkKind = 'one' | 'cut' | 'off' | 'note';

export interface LabMark {
  /** 秒 */
  t: number;
  /** 标的时候对应的拍的下标 */
  beat: number;
  kind: MarkKind;
  text: string;
}

export interface LabLabels {
  /** ok 全对；issues 有问题，已标；null 还没看 */
  status: 'ok' | 'issues' | null;
  note: string;
  marks: LabMark[];
}

/** 一段连续的音乐：算法只给它定一个小节位置 */
export interface LabBlock {
  start: number;
  end: number;
  t0: number;
  t1: number;
  why: 'start' | 'pause' | 'tempo' | 'edit' | 'edit?';
  phase: number;
  /** agree 两个模型一致；split 意见不一；single 只有一个模型 */
  flag: 'agree' | 'split' | 'single';
}

export interface LabGrid {
  version: string;
  bpm: number | null;
  times: number[];
  sections: [number, number][];
  parts: number[];
  blocks: LabBlock[];
  has_allin1: boolean;
  envelope_rate: number;
  envelope: string;
}

export interface LabSample {
  file_id: number;
  name: string;
  activity_name: string | null;
  activity_date: string | null;
  duration: number | null;
  bpm: number | null;
  ready: boolean;
  has_allin1: boolean;
  status: LabLabels['status'];
  marks: number;
}

export const labApi = {
  samples: async () => (await get<{ samples: LabSample[] }>('/api/lab/beats')).samples,
  sample: (id: number) => get<{ grid: LabGrid; labels: LabLabels }>(`/api/lab/beats/${id}`),
  save: async (id: number, labels: LabLabels) =>
    (await put<{ labels: LabLabels }>(`/api/lab/beats/${id}/labels`, labels)).labels,
};
