'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from './Button';
import { useIsMobile } from '@/lib/hooks/useMediaQuery';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnBackdrop?: boolean;
  /** Enable swipe down to close on mobile (default: true) */
  enableSwipeToClose?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  enableSwipeToClose = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  // Swipe to close state
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragThreshold = 100; // pixels to drag before closing
  
  // Handle ESC key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);
  
  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };
  
  // Touch handlers for swipe to close
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !enableSwipeToClose) return;
    dragStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  }, [isMobile, enableSwipeToClose]);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !isMobile || !enableSwipeToClose) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - dragStartY.current;
    // Only allow dragging down
    if (diff > 0) {
      setDragY(diff);
    }
  }, [isDragging, isMobile, enableSwipeToClose]);
  
  const handleTouchEnd = useCallback(() => {
    if (!isMobile || !enableSwipeToClose) {
      setDragY(0);
      setIsDragging(false);
      return;
    }
    if (dragY > dragThreshold) {
      // Reset state before closing
      setDragY(0);
      setIsDragging(false);
      onClose();
    } else {
      setDragY(0);
      setIsDragging(false);
    }
  }, [dragY, isMobile, enableSwipeToClose, onClose]);
  
  if (!isOpen) return null;
  
  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };
  
  // Mobile: full screen or near full screen from bottom
  // Desktop: centered floating modal
  const mobileModalStyles = isMobile
    ? 'inset-x-0 bottom-0 top-auto rounded-t-2xl rounded-b-none max-h-[95vh] w-full'
    : `${sizeStyles[size]} max-h-[90vh] rounded-2xl`;
  
  const mobileContainerStyles = isMobile
    ? 'items-end p-0'
    : 'items-center p-4';
  
  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center bg-primary-black/50 backdrop-blur-md animate-in fade-in duration-200 ${mobileContainerStyles}`}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className={`
          bg-primary-white
          w-full
          ${mobileModalStyles}
          overflow-hidden
          flex flex-col
          shadow-xl
          animate-in fade-in ${isMobile ? 'slide-in-from-bottom' : 'zoom-in-95'} duration-300
        `}
        style={{
          boxShadow: 'var(--shadow-xl)',
          transform: isDragging ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          // Safe area padding for mobile devices with notches
          paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : undefined,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Mobile drag handle */}
        {isMobile && enableSwipeToClose && (
          <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
            <div className="w-10 h-1 bg-accent-gray/40 rounded-full" />
          </div>
        )}
        
        {/* Header */}
        {title && (
          <div className={`flex items-center justify-between border-b border-accent-gray/30 shrink-0 ${isMobile ? 'p-4' : 'p-4 md:p-6'}`}>
            <h2 className={`font-sans font-semibold text-primary-black ${isMobile ? 'text-lg' : 'text-xl md:text-2xl'}`}>
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-accent-gray hover:text-primary-black transition-colors p-2 rounded-lg hover:bg-accent-gray/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="关闭"
            >
              <svg
                className="w-6 h-6"
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
            </button>
          </div>
        )}
        
        {/* Content - scrollable area */}
        <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-4' : 'p-4 md:p-6'}`}>
          {children}
        </div>
        
        {/* Footer - fixed at bottom */}
        {footer && (
          <div className={`flex items-center justify-end gap-3 border-t border-accent-gray/30 shrink-0 ${isMobile ? 'p-4' : 'p-4 md:p-6'}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface ModalFooterProps {
  onCancel?: () => void;
  onConfirm?: () => void;
  cancelText?: string;
  confirmText?: string;
  confirmVariant?: 'primary' | 'danger' | 'success';
  isLoading?: boolean;
}

export function ModalFooter({
  onCancel,
  onConfirm,
  cancelText = '取消',
  confirmText = '确认',
  confirmVariant = 'primary',
  isLoading = false,
}: ModalFooterProps) {
  return (
    <>
      {onCancel && (
        <Button
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          {cancelText}
        </Button>
      )}
      {onConfirm && (
        <Button
          variant={confirmVariant}
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading ? '处理中...' : confirmText}
        </Button>
      )}
    </>
  );
}
