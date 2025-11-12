import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'bordered' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  onClick?: () => void;
}

export function Card({ 
  children, 
  className = '', 
  variant = 'default',
  padding = 'md',
  hoverable = false, 
  onClick,
  ...htmlProps
}: CardProps) {
  // Base functional card styles
  const baseStyles = 'card-functional bg-primary-white';
  
  // Variant styles
  const variantStyles = variant === 'elevated' ? 'elevated' : variant === 'bordered' ? 'bordered' : '';
  
  // Responsive padding styles - mobile-first approach
  const paddingMap = {
    none: '',
    sm: 'p-2 md:p-3',
    md: 'p-4 md:p-6',
    lg: 'p-6 md:p-8'
  };
  const paddingStyles = paddingMap[padding];
  
  // Hoverable and clickable styles
  const interactionStyles = (hoverable || onClick) ? 'cursor-pointer' : '';
  
  return (
    <div
      className={`${baseStyles} ${variantStyles} ${paddingStyles} ${interactionStyles} ${className}`}
      onClick={onClick}
      {...htmlProps}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`mb-4 ${className}`}>
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <h3 className={`text-xl font-semibold text-primary-black ${className}`}>
      {children}
    </h3>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`mt-4 pt-4 border-t border-accent-gray/30 ${className}`}>
      {children}
    </div>
  );
}
