'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card';

export default function ChangelogPage() {
  const updates = [
    {
      date: '2025-12-15',
      title: '🎬 实时流媒体播放优化',
      items: [
        '新增实时 M3U8 快速播放功能',
        '优化视频播放器移动端响应式布局',
      ],
      type: 'feature',
    },
    {
      date: '2025-12-04',
      title: '🚀 系统重构后上线！',
      items: [
        '彻底重写文件分类逻辑',
        '添加自由标签系统',
        '添加请求系统和权限管理',
        '添加批量多选编辑功能',
        '简化文件列表页的信息显示',
        '新增图片和视频显示筛选功能',
        '彻底重写移动端界面',
        '分离原 LockAI 功能',
        '登录页登录移至独立 SSO 服务',
        '感谢 水母老师、噗噗老师、小雪老师、dragon老师 的建议和 issue',
      ],
      type: 'feature',
    },
    {
      date: '2025-11-21',
      title: '文件浏览优化',
      items: [
        '新增文件浏览上一条/下一条功能（来自姜姜的 issue）',
      ],
      type: 'improvement',
    },
    {
      date: '2025-11-19',
      title: '文件编辑功能',
      items: [
        '已上传文件支持编辑和移动操作',
      ],
      type: 'feature',
    },
    {
      date: '2025-11-18',
      title: '视频播放与上传优化',
      items: [
        '彻底重做视频在线播放功能，提升播放体验',
        '重做下载功能，保证手机端正常播放（来自 Mandy 的 issue）',
        '新增上传多任务队列功能',
        '支持单任务多文件上传（来自小雪的 issue）',
      ],
      type: 'improvement',
    },
    {
      date: '2025-11-14',
      title: '移动端适配',
      items: [
        '全面适配移动端使用体验',
        '优化移动端界面布局',
        '改进触摸操作响应',
      ],
      type: 'improvement',
    },
    {
      date: '2025-11-12',
      title: '视频在线播放功能',
      items: [
        '新增视频在线播放功能',
        '支持多种视频格式',
        '优化视频加载速度',
      ],
      type: 'feature',
    },
  ];

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'feature':
        return 'bg-accent-green/10 text-accent-green border border-accent-green/30';
      case 'improvement':
        return 'bg-accent-blue/10 text-accent-blue border border-accent-blue/30';
      case 'fix':
        return 'bg-accent-orange/10 text-accent-orange border border-accent-orange/30';
      default:
        return 'bg-accent-gray/10 text-accent-gray border border-accent-gray/30';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'feature':
        return '✨ 新功能';
      case 'improvement':
        return '🔧 优化';
      case 'fix':
        return '🐛 修复';
      default:
        return '📝 更新';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary-black mb-2">📝 更新日志</h1>
        <p className="text-accent-gray">记录系统的每一次进步与改进</p>
      </div>

      {/* Updates */}
      <div className="space-y-6">
        {updates.map((update, index) => (
          <Card key={index} variant="elevated" padding="lg" hoverable>
            <CardHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <CardTitle className="mb-2">{update.title}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-accent-gray">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{update.date}</span>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getTypeBadge(update.type)}`}>
                  {getTypeLabel(update.type)}
                </span>
              </div>
            </CardHeader>

            <CardContent>
              <ul className="space-y-2.5">
                {update.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex items-start gap-3">
                    <span className="text-accent-orange mt-1 shrink-0">•</span>
                    <span className="text-primary-black leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coming Soon */}
      <div className="mt-8 text-center">
        <p className="text-accent-gray italic">更多精彩功能正在路上...</p>
      </div>

      {/* Footer Note */}
      <Card variant="elevated" padding="lg" className="mt-8 bg-accent-blue/5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-accent-blue/10 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-accent-blue" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-primary-black mb-2">💬 反馈与建议</h3>
            <p className="text-accent-gray leading-relaxed">
              如果您在使用过程中遇到问题或有任何建议，欢迎随时向我们反馈。您的每一条意见都将帮助我们做得更好！
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
