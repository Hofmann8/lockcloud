'use client';

import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

const ANNOUNCEMENT_KEY = 'lockcloud_announcement_seen';
const ANNOUNCEMENT_VERSION = 'v0.6.5'; // 更新此版本号可以让所有用户重新看到公告
const NEVER_SHOW_KEY = 'lockcloud_announcement_never_show';

export function FirstLoginAnnouncement() {
  const [isOpen, setIsOpen] = useState(false);
  const [neverShowAgain, setNeverShowAgain] = useState(false);

  useEffect(() => {
    // 检查用户是否选择了不再显示
    const neverShow = localStorage.getItem(NEVER_SHOW_KEY);
    if (neverShow === 'true') {
      return;
    }

    // 检查用户是否已经看过当前版本的公告
    const seenVersion = localStorage.getItem(ANNOUNCEMENT_KEY);
    
    if (seenVersion !== ANNOUNCEMENT_VERSION) {
      // 延迟显示，让页面先加载完成
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    // 如果用户选择了不再显示，保存该设置
    if (neverShowAgain) {
      localStorage.setItem(NEVER_SHOW_KEY, 'true');
    }
    // 标记用户已看过当前版本的公告
    localStorage.setItem(ANNOUNCEMENT_KEY, ANNOUNCEMENT_VERSION);
    setIsOpen(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="🎉 系统更新 v0.6.5"
      size="lg"
      closeOnBackdrop={false}
    >
      <div className="space-y-4 text-primary-black">
        {/* 更新图标 */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* 更新内容 */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-lg text-blue-800 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            本次更新内容
          </h3>
          
          <div className="text-sm text-gray-700 space-y-2 leading-relaxed">
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <p className="font-medium text-blue-600 mb-1.5">🔧 优化改进</p>
              <ul className="list-disc list-inside space-y-0.5 text-gray-600 ml-2 text-xs">
                <li>新增 <span className="font-semibold text-blue-600">LockAI 队列功能</span>，防止高并发冲突</li>
                <li>新增文件浏览上一条/下一条功能（来自姜姜的 issue）</li>
              </ul>
            </div>
          </div>
        </div>

        {/* LockAI 使用须知 - 重点提示 */}
        <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-300 rounded-lg p-4 space-y-3">
          <h3 className="font-bold text-red-700 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            LockAI 板块使用须知
          </h3>
          
          <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
            <div className="bg-white/80 rounded p-2.5 border border-red-200">
              <p className="font-semibold text-red-600 mb-1.5">⚠️ 法律合规声明</p>
              <ul className="space-y-1 text-gray-700">
                <li>• 使用 LockAI 板块时<span className="font-semibold text-red-600">必须符合当地相关法律法规</span></li>
                <li>• 平台的人工智能服务<span className="font-semibold">仅用于合法逆向测试和 AI 学习使用</span></li>
                <li>• <span className="font-semibold text-red-600">请勿上传任何涉密、敏感或违法内容</span>至 LockAI 板块</li>
              </ul>
            </div>

            <div className="bg-white/80 rounded p-2.5 border border-orange-200">
              <p className="font-semibold text-orange-600 mb-1.5">💡 重要提示</p>
              <ul className="space-y-1 text-gray-700">
                <li>• 扣费为<span className="font-semibold">模拟扣费</span>，不会产生实际消费</li>
                <li>• 本平台<span className="font-semibold">没有任何经营性质</span>，仅供学习交流</li>
                <li>• 由于 AI 约束的特殊性，<span className="font-semibold text-orange-600">使用和测试过程的风险由用户自行承担</span></li>
              </ul>
            </div>
          </div>
        </div>

        {/* 使用范围说明 - 压缩版 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
          <p className="text-xs text-gray-700 leading-relaxed">
            <span className="font-semibold text-blue-600">💙 温馨提示：</span>本系统仅供 DFM 街舞社 Funk&Love Locking 舞队内部使用，请合理使用存储空间。
          </p>
        </div>

        {/* 不再显示选项 */}
        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="neverShowAgain"
            checked={neverShowAgain}
            onChange={(e) => setNeverShowAgain(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
          />
          <label htmlFor="neverShowAgain" className="text-sm text-gray-600 cursor-pointer select-none">
            不再显示系统更新公告
          </label>
        </div>

        {/* 签名和日期 */}
        <div className="text-right text-xs text-gray-500 pt-2 border-t border-gray-200">
          <p className="font-medium text-blue-500">Hofmann</p>
          <p>2025 年 11 月 21 日</p>
        </div>

        {/* 确认按钮 */}
        <div className="pt-2">
          <Button
            variant="primary"
            size="lg"
            onClick={handleClose}
            fullWidth
          >
            {neverShowAgain ? '确认并不再显示' : '我知道了'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
