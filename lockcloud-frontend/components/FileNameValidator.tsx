'use client';

import { isValidFileName, parseFileName } from '@/lib/utils/validation';
import { zhCN } from '@/locales/zh-CN';

interface FileNameValidatorProps {
  filename: string;
}

export function FileNameValidator({ filename }: FileNameValidatorProps) {
  const isValid = isValidFileName(filename);
  const parsed = parseFileName(filename);

  if (isValid && parsed) {
    return (
      <div className="p-4 bg-semantic-success/10 hand-drawn-border border-semantic-success">
        <div className="flex items-start gap-2">
          <svg
            className="w-5 h-5 text-semantic-success shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-semantic-success mb-2">
              文件名格式正确
            </p>
            <div className="text-xs text-accent-gray space-y-1">
              <p>日期: {parsed.year}年{parsed.month}月</p>
              <p>活动: {parsed.activity}</p>
              <p>上传者: {parsed.uploader}</p>
              <p>序号: {parsed.index}</p>
              <p>扩展名: .{parsed.extension}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-semantic-error/10 hand-drawn-border border-semantic-error">
      <div className="flex items-start gap-2">
        <svg
          className="w-5 h-5 text-semantic-error shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-semantic-error mb-2">
            {zhCN.files.invalidFileName}
          </p>
          <div className="text-xs text-accent-gray space-y-1">
            <p className="font-medium text-primary-black">正确格式:</p>
            <p>{zhCN.files.fileNamingHint}</p>
            <p className="text-accent-orange">{zhCN.files.fileNamingExample}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
