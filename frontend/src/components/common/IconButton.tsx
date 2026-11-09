import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type IconButtonVariant = 'default' | 'primary' | 'emergency' | 'ghost' | 'outline';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  icon: ReactNode;
}

const variantStyles: Record<IconButtonVariant, string> = {
  default:
    'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 shadow-xs',
  primary:
    'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 border border-transparent shadow-xs',
  emergency:
    'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 active:bg-rose-200',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 border border-transparent',
  outline:
    'bg-transparent text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900',
};

const sizeStyles: Record<IconButtonSize, string> = {
  sm: 'w-8 h-8 rounded-md min-w-[32px] min-h-[32px]',
  md: 'w-10 h-10 rounded-lg min-w-[40px] min-h-[40px]',
  lg: 'w-11 h-11 rounded-lg min-w-[44px] min-h-[44px]',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      'aria-label': ariaLabel,
      variant = 'default',
      size = 'md',
      icon,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        aria-label={ariaLabel}
        title={ariaLabel}
        disabled={disabled}
        className={`inline-flex items-center justify-center transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer shrink-0 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {icon}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
