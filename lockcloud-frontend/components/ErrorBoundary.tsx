'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from './Button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI with hand-drawn style
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-white">
          <div className="max-w-md w-full">
            <div className="hand-drawn-border bg-white p-8 text-center">
              <div className="text-6xl mb-4">😵</div>
              <h1 className="text-2xl font-bold mb-2 text-black">
                哎呀，出错了
              </h1>
              <p className="text-gray-600 mb-6">
                页面遇到了一些问题，请刷新页面重试
              </p>
              {this.state.error && (
                <div className="mb-6 p-4 bg-gray-50 rounded text-left text-sm text-gray-700 overflow-auto max-h-32">
                  <code>{this.state.error.message}</code>
                </div>
              )}
              <div className="flex gap-4 justify-center">
                <Button onClick={this.handleReset}>重试</Button>
                <Button onClick={() => window.location.href = '/'}>
                  返回首页
                </Button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
