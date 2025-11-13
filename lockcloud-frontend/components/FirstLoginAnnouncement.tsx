'use client';

import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

const ANNOUNCEMENT_KEY = 'lockcloud_announcement_seen';
const ANNOUNCEMENT_VERSION = '2025-11-13'; // 更新此版本号可以让所有用户重新看到公告

export function FirstLoginAnnouncement() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
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
    // 标记用户已看过当前版本的公告
    localStorage.setItem(ANNOUNCEMENT_KEY, ANNOUNCEMENT_VERSION);
    setIsOpen(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="系统公告"
      size="lg"
      closeOnBackdrop={false}
    >
      <div className="space-y-4 text-primary-black">
        {/* 警告图标 */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* 公告内容 */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-lg text-orange-800 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            重要提示
          </h3>
          
          <div className="text-sm text-gray-700 space-y-2 leading-relaxed">
            <p>
              本系统目前<span className="font-semibold text-orange-600">尚未完全开发完成</span>，仅处于初步压力测试阶段。
            </p>
            
            <div className="bg-white rounded p-3 space-y-2 border border-orange-100">
              <p className="font-medium text-orange-700">⚠️ 测试期间注意事项：</p>
              <ul className="list-disc list-inside space-y-1 text-gray-600 ml-2">
                <li>上传的文件<span className="font-medium">有可能被删除或保留</span></li>
                <li>账号系统<span className="font-medium">可能会被重置</span></li>
                <li>系统功能和数据<span className="font-medium">不保证稳定性</span></li>
              </ul>
            </div>

            <p className="pt-2">
              <span className="font-medium text-blue-600">正式上线时间：</span>
              将在 ICP 备案通过后正式发布
            </p>
          </div>
        </div>

        {/* 使用范围说明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-blue-800 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
            使用范围
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            本系统<span className="font-semibold text-blue-600">仅供 DFM 街舞社 Funk&Love Locking 舞队内部使用</span>。
            其他舞队如需使用，请先获得舞队队长 <span className="font-semibold">Dragon</span> 的同意。
          </p>
        </div>

        {/* 签名和日期 */}
        <div className="text-right text-sm text-gray-600 pt-2 border-t border-gray-200">
          <p className="font-medium text-orange-500">Hofmann</p>
          <p>2025 年 11 月 13 日</p>
        </div>

        {/* 确认按钮 */}
        <div className="pt-4">
          <Button
            variant="primary"
            size="lg"
            onClick={handleClose}
            fullWidth
          >
            我已知晓，继续使用
          </Button>
        </div>
      </div>
    </Modal>
  );
}
