import type { CSSProperties, ReactNode } from 'react';

export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'dark'
  | 'outline';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  size?: BadgeSize;
  style?: CSSProperties;
}

const TONES: Record<BadgeTone, { bg: string; fg: string; border?: string }> = {
  neutral: { bg: '#F1F5F9', fg: '#475569' },
  primary: { bg: '#EEF2FF', fg: '#4338CA' },
  success: { bg: '#ECFDF5', fg: '#047857' },
  warning: { bg: '#FFFBEB', fg: '#B45309' },
  danger: { bg: '#FEF2F2', fg: '#B91C1C' },
  info: { bg: '#F0F9FF', fg: '#0369A1' },
  dark: { bg: '#0F172A', fg: '#fff' },
  outline: { bg: 'transparent', fg: '#475569', border: '#CBD5E1' },
};

export function Badge({ children, tone = 'neutral', size = 'sm', style }: BadgeProps) {
  const t = TONES[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        fontSize: size === 'sm' ? 11 : 12,
        fontWeight: 500,
        lineHeight: 1.4,
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        border: t.border ? `1px solid ${t.border}` : 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
