import type { CSSProperties, ReactNode } from 'react';
import { TOKENS } from '../tokens';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  style?: CSSProperties;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'sm',
  style,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        ...style,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            style={{
              height: size === 'sm' ? 30 : 34,
              padding: size === 'sm' ? '0 12px' : '0 14px',
              borderRadius: 6,
              border: `1px solid ${active ? TOKENS.primary : TOKENS.border}`,
              background: active ? TOKENS.primarySoft : '#fff',
              color: active ? TOKENS.primaryDeep : TOKENS.text2,
              fontSize: size === 'sm' ? 12.5 : 13,
              fontWeight: active ? 600 : 500,
              cursor: option.disabled ? 'not-allowed' : 'pointer',
              opacity: option.disabled ? 0.55 : 1,
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
