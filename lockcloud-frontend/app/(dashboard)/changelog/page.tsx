'use client';

type EntryType = 'feature' | 'improvement' | 'fix';

interface Entry {
  date: string;          // YYYY-MM-DD
  version?: string;      // 可选,标语义化版本号才显示
  title: string;
  items: string[];
  type: EntryType;
}

const UPDATES: Entry[] = [
  {
    date: '2026-05-22',
    version: '1.1.0',
    title: '智能版',
    items: [
      'AI 智能搜索:用自然语言描述就能找到想要的照片',
      '人脸识别 + 人物自动分组,系统会把同一个人的照片聚到一起',
      '"找同一个人":点击照片里的人脸,即可查看 TA 的全部出场',
      '人物管理:支持命名、合并同名人物、指定代表照片',
      '人物头像缩略图加载与缓存策略优化',
    ],
    type: 'feature',
  },
  {
    date: '2026-01-07',
    version: '1.0.0',
    title: '正式版',
    items: [
      '优化移动端下载功能',
      '新增批量下载和打包下载',
      '新增用户头像功能',
      '优化图片加载体验',
      '优化 HLS 流媒体算法',
      '存储策略升级:从公有读私有写改为后端统一签发的私有读写,更安全',
      '新增 ThumbHash 媒体占位图,加载更流畅',
      '整体 UI 质感打磨',
    ],
    type: 'feature',
  },
  {
    date: '2025-12-15',
    title: '实时流媒体播放优化',
    items: [
      '新增实时 M3U8 快速播放',
      '视频播放器移动端响应式布局调整',
    ],
    type: 'feature',
  },
  {
    date: '2025-12-04',
    title: '系统重构后上线',
    items: [
      '重写文件分类逻辑',
      '新增自由标签系统',
      '新增请求系统与权限管理',
      '新增批量多选编辑功能',
      '简化文件列表页的信息显示',
      '新增图片与视频显示筛选',
      '重写移动端界面',
      '分离原 LockAI 功能',
      '登录页登录迁至独立 SSO 服务',
      '感谢 水母、噗噗、小雪、dragon 的建议与 issue',
    ],
    type: 'feature',
  },
  {
    date: '2025-11-21',
    title: '文件浏览优化',
    items: ['新增文件浏览上一条 / 下一条(来自姜姜的 issue)'],
    type: 'improvement',
  },
  {
    date: '2025-11-19',
    title: '文件编辑功能',
    items: ['已上传文件支持编辑与移动操作'],
    type: 'feature',
  },
  {
    date: '2025-11-18',
    title: '视频播放与上传优化',
    items: [
      '重做视频在线播放,提升播放体验',
      '重做下载,保证手机端正常播放(来自 Mandy 的 issue)',
      '新增上传多任务队列',
      '支持单任务多文件上传(来自小雪的 issue)',
    ],
    type: 'improvement',
  },
  {
    date: '2025-11-14',
    title: '移动端适配',
    items: [
      '全面适配移动端使用体验',
      '移动端界面布局优化',
      '触摸操作响应改进',
    ],
    type: 'improvement',
  },
  {
    date: '2025-11-12',
    title: '视频在线播放',
    items: [
      '新增视频在线播放功能',
      '支持多种视频格式',
      '优化视频加载速度',
    ],
    type: 'feature',
  },
];

const TYPE_LABEL: Record<EntryType, string> = {
  feature: '新功能',
  improvement: '优化',
  fix: '修复',
};

// 不同 type 在 timeline 圆点和 type 标签上用不同色;
// 复用 globals.css 里已有的三个 accent 颜色,不引入新的 hex
const TYPE_DOT: Record<EntryType, string> = {
  feature: 'bg-accent-orange',
  improvement: 'bg-accent-blue',
  fix: 'bg-accent-gray',
};
const TYPE_TEXT: Record<EntryType, string> = {
  feature: 'text-accent-orange',
  improvement: 'text-accent-blue',
  fix: 'text-accent-gray',
};

export default function ChangelogPage() {
  return (
    <div className="container mx-auto px-4 py-10 md:py-16">
      {/* Page header */}
      <header className="max-w-3xl mb-12 md:mb-16">
        <p className="text-xs tracking-[0.2em] uppercase text-accent-gray mb-3">
          Release Notes
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-primary-black tracking-tight leading-[1.1]">
          更新日志
        </h1>
        <p className="mt-4 text-base text-accent-gray leading-relaxed">
          每一次迭代都记在这里。
        </p>
        <hr className="mt-10 border-t border-primary-black/10" />
      </header>

      {/* Timeline */}
      <div className="max-w-3xl">
        <ol className="relative">
          {/* vertical rail */}
          <span
            aria-hidden
            className="absolute left-[7px] top-2 bottom-2 w-px bg-primary-black/10"
          />

          {UPDATES.map((u, i) => (
            <li key={i} className="relative pl-10 pb-12 last:pb-0">
              {/* dot */}
              <span
                aria-hidden
                className={`absolute left-0 top-2.5 w-[15px] h-[15px] rounded-full ring-4 ring-primary-white ${TYPE_DOT[u.type]}`}
              />

              {/* meta row */}
              <div className="flex items-center gap-3 mb-2 text-xs text-accent-gray">
                <time className="font-mono tracking-tight">{u.date}</time>
                <span aria-hidden className="text-primary-black/20">·</span>
                <span className={`uppercase tracking-[0.15em] ${TYPE_TEXT[u.type]}`}>
                  {TYPE_LABEL[u.type]}
                </span>
                {u.version && (
                  <>
                    <span aria-hidden className="text-primary-black/20">·</span>
                    <span className="font-mono text-primary-black/60">
                      v{u.version}
                    </span>
                  </>
                )}
              </div>

              {/* title */}
              <h2 className="text-2xl md:text-[28px] font-semibold text-primary-black tracking-tight leading-snug mb-4">
                {u.title}
              </h2>

              {/* items */}
              <ul className="space-y-2.5">
                {u.items.map((item, idx) => (
                  <li
                    key={idx}
                    className="text-[15px] md:text-base text-primary-black/80 leading-relaxed flex gap-3"
                  >
                    <span
                      aria-hidden
                      className="mt-2.5 w-1 h-1 rounded-full bg-primary-black/40 shrink-0"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>

      {/* Footer */}
      <footer className="max-w-3xl mt-16 pt-10 border-t border-primary-black/10">
        <p className="text-sm text-accent-gray leading-relaxed">
          有问题或建议,直接联系管理员。每条反馈都会被认真对待。
        </p>
      </footer>
    </div>
  );
}
