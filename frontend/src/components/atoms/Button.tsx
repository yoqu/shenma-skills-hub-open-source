import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { TOKENS } from '@/lib/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'dark';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  full?: boolean;
  style?: CSSProperties;
}

const SIZES: Record<ButtonSize, { px: number; py: number; fs: number; h: number }> = {
  sm: { px: 10, py: 5, fs: 12, h: 28 },
  md: { px: 14, py: 7, fs: 13, h: 34 },
  lg: { px: 18, py: 10, fs: 14, h: 42 },
};

const VARIANTS: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: TOKENS.primary, fg: '#fff', border: TOKENS.primary },
  secondary: { bg: '#fff', fg: TOKENS.text, border: TOKENS.border },
  ghost: { bg: 'transparent', fg: TOKENS.text2, border: 'transparent' },
  danger: { bg: '#fff', fg: TOKENS.danger, border: '#FECACA' },
  success: { bg: TOKENS.success, fg: '#fff', border: TOKENS.success },
  dark: { bg: TOKENS.text, fg: '#fff', border: TOKENS.text },
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  full,
  style,
  ...rest
}: ButtonProps) {
  const s = SIZES[size];
  const v = VARIANTS[variant];
  return (
    <button
      {...rest}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: `${s.py}px ${s.px}px`,
        height: s.h,
        fontSize: s.fs,
        fontWeight: 500,
        background: v.bg,
        color: v.fg,
        border: `1px solid ${v.border}`,
        borderRadius: 8,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        width: full ? '100%' : 'auto',
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
