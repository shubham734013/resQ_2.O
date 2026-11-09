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
    'text-white font-semibold transition-all duration-200',
  secondary:
    'font-medium transition-all duration-200',
  emergency:
    'text-white font-bold transition-all duration-200',
  outline:
    'font-medium transition-all duration-200',
  ghost:
    'font-medium transition-all duration-200',
};

const variantInlineStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
    boxShadow: '0 4px 16px rgba(244,63,94,0.25)',
    border: '1px solid transparent',
  },
  secondary: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.80)',
  },
  emergency: {
    background: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
    boxShadow: '0 4px 20px rgba(244,63,94,0.35)',
    border: '1px solid transparent',
  },
  outline: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.14)',
    color: 'rgba(255,255,255,0.75)',
  },
  ghost: {
    background: 'transparent',
    border: '1px solid transparent',
    color: 'rgba(255,255,255,0.55)',
  },
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-2.5 py-1.5 h-8 gap-1.5 rounded-lg min-w-[2rem]',
  md: 'text-sm px-4 py-2 h-10 gap-2 rounded-xl min-w-[2.5rem]',
  lg: 'text-sm px-5 py-2.5 h-11 gap-2.5 rounded-xl min-w-[3rem]',
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
      style,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`inline-flex items-center justify-center select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent disabled:opacity-50 disabled:pointer-events-none cursor-pointer font-sans ${
          variantStyles[variant]
        } ${sizeStyles[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        style={{ ...variantInlineStyles[variant], ...style }}
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
