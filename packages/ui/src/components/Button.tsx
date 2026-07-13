import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { TOKENS } from '../tokens';

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

/**
 * Button 的外观用行内 style 落地，是经过权衡的刻意选择，不要改成 CSS class：
 * 项目使用经典（未分层）Tailwind Preflight，它带着 `*{border-width:0}` 与
 * `button{background-color:transparent}` 这类未分层 author 规则。未分层规则会盖过任何
 * `@layer`，也很难被「既要压过 Preflight 又要让调用方 class 覆盖」的普通 class 同时满足。
 * 行内 style 的优先级高于未分层 author 规则，所以这里用行内才能稳定渲染。
 *
 * 需要逐实例改外观时，请传 `style`（行内、最高优先级，已在末尾展开覆盖默认值）。
 * `className` 会通过 `...rest` 透传，可用于挂工具类 / 标记类，但无法覆盖上面的行内外观。
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, variant = 'primary', size = 'md', icon, full, style, ...rest },
  ref,
) {
  const s = SIZES[size];
  const v = VARIANTS[variant];
  return (
    <button
      ref={ref}
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
});
