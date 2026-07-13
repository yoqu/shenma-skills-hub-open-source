import type { InputHTMLAttributes, ReactNode } from 'react';
import { TOKENS } from '../tokens';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
}

export function Checkbox({ label, style, ...props }: CheckboxProps) {
  const box = (
    <input
      {...props}
      type="checkbox"
      style={{
        width: 14,
        height: 14,
        margin: 0,
        accentColor: TOKENS.primary,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    />
  );

  if (!label) return box;

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        color: TOKENS.text2,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {box}
      <span>{label}</span>
    </label>
  );
}
