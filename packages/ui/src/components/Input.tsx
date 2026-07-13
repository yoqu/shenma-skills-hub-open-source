import type { CSSProperties } from 'react';
import { TOKENS } from '../tokens';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  state?: 'default' | 'success' | 'error';
}

export function Input({ state = 'default', style, ...props }: InputProps) {
  const borderColor =
    state === 'success' ? TOKENS.success : state === 'error' ? TOKENS.danger : TOKENS.border;
  return (
    <input
      style={{
        width: '100%',
        padding: '10px 12px',
        fontSize: 14,
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        outline: 'none',
        background: '#fff',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    />
  );
}
