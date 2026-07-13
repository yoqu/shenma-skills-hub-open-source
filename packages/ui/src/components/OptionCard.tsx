import type { ReactNode } from 'react';
import { TOKENS } from '../tokens';

interface OptionCardProps {
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export function OptionCard({
  value,
  checked,
  onChange,
  title,
  description,
  icon,
  disabled,
}: OptionCardProps) {
  return (
    <div
      role="radio"
      aria-checked={checked}
      onClick={() => !disabled && onChange(value)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        border: checked ? `2px solid ${TOKENS.primary}` : `1px solid ${TOKENS.border}`,
        borderRadius: 8,
        background: checked ? TOKENS.primarySoft : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'border-color .15s, background .15s',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: checked ? `4px solid ${TOKENS.primary}` : `1.5px solid ${TOKENS.text3}`,
          flexShrink: 0,
          transition: 'border .15s',
        }}
      />
      {icon && <div style={{ flexShrink: 0 }}>{icon}</div>}
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: TOKENS.text }}>{title}</div>
        {description && (
          <div style={{ fontSize: 12, color: TOKENS.text3, marginTop: 2 }}>{description}</div>
        )}
      </div>
    </div>
  );
}
