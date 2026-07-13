import type { InputHTMLAttributes } from 'react';
import { TOKENS } from '../tokens';
import { I } from '../icons';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  width?: number | string;
}

export function SearchInput({ width = '100%', style, ...props }: SearchInputProps) {
  return (
    <div style={{ position: 'relative', width, maxWidth: '100%' }}>
      <I.search
        size={15}
        style={{ position: 'absolute', left: 12, top: 11, color: TOKENS.text3 }}
      />
      <input
        {...props}
        type="search"
        style={{
          width: '100%',
          height: 38,
          padding: '0 12px 0 34px',
          fontSize: 13.5,
          background: TOKENS.bgAlt,
          border: `1px solid ${TOKENS.borderSoft}`,
          borderRadius: 8,
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          ...style,
        }}
      />
    </div>
  );
}
