import type { ReactNode, InputHTMLAttributes } from 'react';
import { TOKENS } from '../tokens';

interface PrefixInputProps {
  prefix: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  state?: 'default' | 'success' | 'error';
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

export function PrefixInput({
  prefix,
  value,
  onChange,
  placeholder,
  disabled,
  readOnly,
  state = 'default',
  inputProps,
}: PrefixInputProps) {
  const borderColor =
    state === 'success' ? TOKENS.success : state === 'error' ? TOKENS.danger : TOKENS.border;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          background: TOKENS.bgGray,
          borderRight: `1px solid ${TOKENS.border}`,
          fontSize: 13,
          color: TOKENS.text2,
          whiteSpace: 'nowrap',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        {prefix}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        style={{
          flex: 1,
          padding: '10px 12px',
          fontSize: 14,
          border: 'none',
          outline: 'none',
          background: disabled ? TOKENS.bgGray : '#fff',
          fontFamily: 'inherit',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
        {...inputProps}
      />
    </div>
  );
}
