import { TOKENS } from '../tokens';
import { I } from '../icons';

interface PhoneInputProps {
  value: string;             // 11位纯数字（无空格）
  onChange: (raw: string) => void;  // 回调返回纯数字
  error?: string;
  state?: 'default' | 'success' | 'error';
  id?: string;
}

function formatPhone(digits: string): string {
  return digits.replace(/(\d{3})(\d{0,4})(\d{0,4})/, (_m, a, b, c) =>
    [a, b, c].filter(Boolean).join(' '),
  );
}

export function PhoneInput({ value, onChange, error, state = 'default', id }: PhoneInputProps) {
  const borderColor =
    state === 'success' ? TOKENS.success : state === 'error' ? TOKENS.danger : TOKENS.border;
  const displayed = formatPhone(value);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
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
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        +86
      </div>
      <input
        id={id}
        value={displayed}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
          onChange(digits);
        }}
        placeholder="138 0000 0000"
        inputMode="numeric"
        autoComplete="tel-national"
        aria-invalid={state === 'error'}
        aria-describedby={error && id ? `${id}-error` : undefined}
        style={{
          flex: 1,
          padding: '10px 12px',
          fontSize: 14,
          border: 'none',
          outline: 'none',
          background: '#fff',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          letterSpacing: 0.4,
          minWidth: 0,
        }}
      />
      {state === 'success' && (
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            padding: '0 12px',
            color: TOKENS.success,
            flexShrink: 0,
          }}
        >
          <I.check size={16} stroke={2.5} />
        </div>
      )}
    </div>
  );
}
