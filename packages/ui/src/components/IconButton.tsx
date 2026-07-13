import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { TOKENS } from '../tokens';

export type IconButtonVariant = 'ghost' | 'soft' | 'secondary' | 'danger';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style' | 'children'> {
  label: string;
  icon: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  active?: boolean;
  style?: CSSProperties;
}

const SIZE: Record<IconButtonSize, number> = {
  sm: 28,
  md: 32,
  lg: 36,
};

function colors(variant: IconButtonVariant, active?: boolean) {
  if (variant === 'danger') {
    return {
      background: active ? TOKENS.dangerSoft : '#fff',
      border: '#FECACA',
      color: TOKENS.danger,
    };
  }
  if (variant === 'secondary') {
    return {
      background: active ? TOKENS.bgGray : '#fff',
      border: TOKENS.border,
      color: TOKENS.text2,
    };
  }
  if (variant === 'soft') {
    return {
      background: active ? TOKENS.bgGray : TOKENS.bgAlt,
      border: TOKENS.borderSoft,
      color: TOKENS.text2,
    };
  }
  return {
    background: active ? TOKENS.bgGray : 'transparent',
    border: 'transparent',
    color: TOKENS.text2,
  };
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  active,
  disabled,
  type = 'button',
  style,
  ...props
}: IconButtonProps) {
  const dimension = SIZE[size];
  const c = colors(variant, active);

  return (
    <button
      {...props}
      type={type}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        position: 'relative',
        display: 'inline-grid',
        placeItems: 'center',
        width: dimension,
        height: dimension,
        padding: 0,
        borderRadius: 8,
        border: `1px solid ${c.border}`,
        background: c.background,
        color: c.color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        fontFamily: 'inherit',
        ...style,
      }}
    >
      {icon}
    </button>
  );
}
