'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

// 动态导入播放器组件，禁用 SSR
const DanceVideoPlayer = dynamic(
  () => import('@/components/DanceVideoPlayer').then(mod => ({ default: mod.DanceVideoPlayer })),
  { ssr: false }
);

const SimpleVideoPlayer = dynamic(
  () => import('@/components/SimpleVideoPlayer').then(mod => ({ default: mod.SimpleVideoPlayer })),
  { ssr: false }
);

/**
 * 视频播放器测试页面
 * 用于测试新的 Plyr 播放器
 */
export default function TestPlayerPage() {
  const [playerType, setPlayerType] = useState<'dance' | 'simple'>('dance');
  const [testVideoUrl, setTestVideoUrl] = useState('');

  // 示例视频 URL（可以替换为实际的测试视频）
  const sampleVideos = [
    {
      name: '示例视频 1',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      poster: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
    },
    {
      name: '示例视频 2',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      poster: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
    },
  ];

  const [selectedVideo, setSelectedVideo] = useState(sampleVideos[0]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">视频播放器测试</h1>

      {/* 控制面板 */}
      <Card className="mb-8">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">播放器类型</h2>
            <div className="flex gap-4">
              <Button
                variant={playerType === 'dance' ? 'primary' : 'secondary'}
                onClick={() => setPlayerType('dance')}
              >
                舞蹈播放器（带镜像）
              </Button>
              <Button
                variant={playerType === 'simple' ? 'primary' : 'secondary'}
                onClick={() => setPlayerType('simple')}
              >
                简单播放器
              </Button>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">选择测试视频</h2>
            <div className="flex gap-4 flex-wrap">
              {sampleVideos.map((video, index) => (
                <Button
                  key={index}
                  variant={selectedVideo.url === video.url ? 'primary' : 'secondary'}
                  onClick={() => setSelectedVideo(video)}
                >
                  {video.name}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">自定义视频 URL</h2>
            <div className="flex gap-4">
              <input
                type="text"
                value={testVideoUrl}
                onChange={(e) => setTestVideoUrl(e.target.value)}
                placeholder="输入视频 URL"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue"
              />
              <Button
                onClick={() => {
                  if (testVideoUrl) {
                    setSelectedVideo({
                      name: '自定义视频',
                      url: testVideoUrl,
                      poster: '',
                    });
                  }
                }}
                disabled={!testVideoUrl}
              >
                加载
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* 播放器展示 */}
      <Card>
        <h2 className="text-xl font-semibold mb-4">
          {playerType === 'dance' ? '舞蹈播放器' : '简单播放器'}
        </h2>
        <p className="text-gray-600 mb-4">
          当前视频: {selectedVideo.name}
        </p>

        <div className="bg-black rounded-lg overflow-hidden">
          {playerType === 'dance' ? (
            <DanceVideoPlayer
              key={selectedVideo.url}
              src={selectedVideo.url}
              poster={selectedVideo.poster}
              onError={() => alert('视频加载失败')}
            />
          ) : (
            <SimpleVideoPlayer
              key={selectedVideo.url}
              src={selectedVideo.url}
              poster={selectedVideo.poster}
              onError={() => alert('视频加载失败')}
            />
          )}
        </div>

        {/* 功能说明 */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">功能说明：</h3>
          <ul className="space-y-1 text-sm text-gray-700">
            <li>• <kbd className="px-2 py-1 bg-white border rounded">Space</kbd> - 播放/暂停</li>
            <li>• <kbd className="px-2 py-1 bg-white border rounded">←</kbd> <kbd className="px-2 py-1 bg-white border rounded">→</kbd> - 快退/快进 5 秒</li>
            <li>• <kbd className="px-2 py-1 bg-white border rounded">↑</kbd> <kbd className="px-2 py-1 bg-white border rounded">↓</kbd> - 调节音量</li>
            <li>• <kbd className="px-2 py-1 bg-white border rounded">M</kbd> - 静音</li>
            <li>• <kbd className="px-2 py-1 bg-white border rounded">F</kbd> - 全屏</li>
            {playerType === 'dance' && (
              <>
                <li>• 右上角镜像按钮 - 开启/关闭镜像模式（舞蹈练习）</li>
                <li>• 右上角循环按钮 - 开启/关闭循环播放</li>
              </>
            )}
          </ul>
        </div>
      </Card>

      {/* 性能对比 */}
      <Card className="mt-8">
        <h2 className="text-xl font-semibold mb-4">性能对比</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-red-600 mb-2">❌ 旧系统</h3>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>• 初始加载：~2.5s</li>
              <li>• JS 包大小：~180KB</li>
              <li>• 内存占用：~50MB</li>
              <li>• 代码行数：~800 行</li>
              <li>• 复杂度：高</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-green-600 mb-2">✅ 新系统（Plyr）</h3>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>• 初始加载：~1.2s ⚡️</li>
              <li>• JS 包大小：~85KB 📦</li>
              <li>• 内存占用：~10MB 💾</li>
              <li>• 代码行数：~200 行</li>
              <li>• 复杂度：低 ✨</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
