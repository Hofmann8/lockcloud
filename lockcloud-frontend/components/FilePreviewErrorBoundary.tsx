'use client';

import React, { Component, ReactNode } from 'react';
import { ErrorCard } from './ErrorCard';
import { Button } from './Button';
import { zhCN } from '@/locales/zh-CN';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * FilePreviewErrorBoundary Component
 * 
 * Error boundary specifically for file preview functionality.
 * Catches unexpected errors during rendering and provides a fallback UI.
 * 
 * Features:
 * - Catches React rendering errors
 * - Displays user-friendly error message
 * - Provides retry and back navigation options
 * - Logs errors for debugging
 * 
 * Requirements: 1.1 (Error handling)
 */
export class FilePreviewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for debugging
    console.error('File preview error:', error);
    console.error('Error info:', errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
    
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      // Default: reload the page
      window.location.reload();
    }
  };

  handleBack = () => {
    window.history.back();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-3 sm:space-y-4 lg:space-y-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="md"
              onClick={this.handleBack}
              icon={
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              }
            >
              <span className="hidden xs:inline">{zhCN.common.back}</span>
            </Button>
          </div>
          
          <ErrorCard
            title="预览出错"
            message={
              this.state.error?.message || 
              "文件预览时发生意外错误，请尝试刷新页面或返回文件列表"
            }
            variant="error"
            action={{
              label: "重新加载",
              onClick: this.handleReset,
            }}
          />

          {/* Additional debug info in development */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mt-4 p-4 bg-gray-100 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                开发模式 - 错误详情:
              </h4>
              <pre className="text-xs text-gray-600 overflow-auto">
                {this.state.error.stack}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
