import type { CSSProperties } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { TOKENS } from '../tokens';
import { I } from '../icons';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectChangeEvent {
  target: {
    name?: string;
    value: string;
  };
}

interface SelectProps {
  options: SelectOption[];
  placeholder?: string;
  state?: 'default' | 'success' | 'error';
  value?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  style?: CSSProperties;
  onChange?: (event: SelectChangeEvent) => void;
  onValueChange?: (value: string) => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export function Select({
  options,
  placeholder,
  state = 'default',
  style,
  value = '',
  name,
  id,
  disabled,
  required,
  onChange,
  onValueChange,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: SelectProps) {
  const borderColor =
    state === 'success' ? TOKENS.success : state === 'error' ? TOKENS.danger : TOKENS.border;
  const selected = options.find((option) => option.value === value);
  const display = selected?.label ?? placeholder ?? '请选择';
  const muted = !selected || value === '';

  function commit(nextValue: string) {
    onValueChange?.(nextValue);
    onChange?.({ target: { name, value: nextValue } });
  }

  return (
    <DropdownMenu.Root>
      {name && <input type="hidden" name={name} value={value} required={required} />}
      <DropdownMenu.Trigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-invalid={state === 'error' ? true : undefined}
          style={{
            width: '100%',
            minWidth: 0,
            padding: '10px 10px 10px 12px',
            fontSize: 14,
            border: `1px solid ${borderColor}`,
            borderRadius: 8,
            outline: 'none',
            background: disabled ? TOKENS.bgAlt : '#fff',
            color: muted ? TOKENS.text3 : TOKENS.text,
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.65 : 1,
            textAlign: 'left',
            ...style,
          }}
        >
          <span
            style={{
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {display}
          </span>
          <I.chev size={13} style={{ flex: '0 0 auto', color: TOKENS.text3 }} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={5}
          align="start"
          style={{
            width: 'var(--radix-dropdown-menu-trigger-width)',
            minWidth: 150,
            maxHeight: 280,
            overflow: 'auto',
            padding: 4,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 8,
            background: '#fff',
            boxShadow: '0 16px 36px rgba(15, 23, 42, 0.14)',
            zIndex: 1000,
          }}
        >
          {placeholder && !options.some((option) => option.value === '') && (
            <DropdownMenu.Item
              disabled
              style={optionStyle({ disabled: true, active: false })}
            >
              {placeholder}
            </DropdownMenu.Item>
          )}
          {options.map((option) => {
            const active = option.value === value;
            return (
              <DropdownMenu.Item
                key={option.value}
                disabled={option.disabled}
                onSelect={() => commit(option.value)}
                style={optionStyle({ active, disabled: option.disabled })}
              >
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {option.label}
                </span>
                {active && <I.check size={12} style={{ marginLeft: 'auto', color: TOKENS.primary }} />}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function optionStyle({
  active,
  disabled,
}: {
  active: boolean;
  disabled?: boolean;
}): CSSProperties {
  return {
    minHeight: 30,
    padding: '7px 9px',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: disabled ? TOKENS.text3 : active ? TOKENS.primaryDeep : TOKENS.text2,
    background: active ? TOKENS.primarySoft : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    outline: 'none',
  };
}
