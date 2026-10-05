import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'emergency' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 focus-visible:ring-slate-900 border border-transparent shadow-xs',
  secondary:
    'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-slate-500 shadow-xs',
  emergency:
    'bg-rose-700 text-white hover:bg-rose-800 active:bg-rose-900 focus-visible:ring-rose-700 border border-transparent shadow-xs font-semibold',
  outline:
    'bg-transparent text-slate-700 border border-slate-300 hover:bg-slate-100 active:bg-slate-200 focus-visible:ring-slate-400',
  ghost:
    'bg-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 focus-visible:ring-slate-400 border border-transparent',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-2.5 py-1.5 h-8 gap-1.5 rounded-md min-w-[2rem]',
  md: 'text-sm px-3.5 py-2 h-10 gap-2 rounded-lg min-w-[2.5rem]',
  lg: 'text-base px-4 py-2.5 h-11 gap-2.5 rounded-lg min-w-[3rem]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      iconPosition = 'left',
      fullWidth = false,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`inline-flex items-center justify-center font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${
          variantStyles[variant]
        } ${sizeStyles[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        {...props}
      >
        {icon && iconPosition === 'left' && (
          <span className="inline-flex shrink-0 items-center justify-center">{icon}</span>
        )}
        {children && <span>{children}</span>}
        {icon && iconPosition === 'right' && (
          <span className="inline-flex shrink-0 items-center justify-center">{icon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
