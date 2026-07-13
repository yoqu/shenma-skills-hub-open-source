import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

export interface PressableProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  children?: ReactNode;
  style?: CSSProperties;
}

/**
 * Low-level button reset for custom controls that still need local layout styles.
 * Prefer Button/IconButton/SegmentedControl for standard controls.
 */
export function Pressable({
  children,
  disabled,
  type = 'button',
  style,
  ...props
}: PressableProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled}
      style={{
        font: 'inherit',
        color: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : undefined,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
