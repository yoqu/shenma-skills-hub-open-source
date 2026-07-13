import type { InputHTMLAttributes } from 'react';
import { TOKENS } from '../tokens';

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  width?: number | string;
}

export function Slider({ width = '100%', style, ...props }: SliderProps) {
  return (
    <input
      {...props}
      type="range"
      style={{
        width,
        accentColor: TOKENS.primary,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    />
  );
}
