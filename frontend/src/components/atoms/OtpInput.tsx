import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { TOKENS } from '@/lib/tokens';

export interface OtpInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** 触发完整 6 位填充后调用（粘贴 / 输入到最后一格）。 */
  onComplete?: (code: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg';
}

/**
 * 6 位短信验证码输入：
 * - 自动跳到下一格
 * - 退格回退到上一格
 * - 左右方向键移动焦点
 * - 粘贴整段数字一次性填充
 * - 浏览器/系统短信自动填充（autoComplete="one-time-code"）
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  autoFocus = true,
  disabled = false,
  size = 'lg',
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus && refs.current[0]) {
      refs.current[0].focus();
    }
  }, [autoFocus]);

  function setAt(i: number, ch: string) {
    const next = [...value];
    next[i] = ch;
    onChange(next);
    if (ch && i === length - 1 && next.every((c) => /^\d$/.test(c))) {
      onComplete?.(next.join(''));
    }
  }

  function focusAt(i: number) {
    const target = refs.current[i];
    if (target) {
      target.focus();
      target.select();
    }
  }

  function handleChange(i: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1);
    setAt(i, digit);
    if (digit && i < length - 1) {
      focusAt(i + 1);
    }
  }

  function handleKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (value[i]) {
        setAt(i, '');
      } else if (i > 0) {
        focusAt(i - 1);
        setAt(i - 1, '');
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      focusAt(i - 1);
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      focusAt(i + 1);
      e.preventDefault();
    }
  }

  function handlePaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!text) return;
    e.preventDefault();
    const next = [...value];
    for (let k = 0; k < length; k++) {
      if (k < i) continue;
      const ch = text[k - i];
      next[k] = ch || '';
    }
    onChange(next);
    const lastFilled = Math.min(i + text.length, length) - 1;
    focusAt(Math.max(0, lastFilled));
    if (next.every((c) => /^\d$/.test(c))) {
      onComplete?.(next.join(''));
    }
  }

  const h = size === 'lg' ? 56 : 48;
  const fs = size === 'lg' ? 22 : 18;

  return (
    <div className="otp-row" style={{ display: 'flex', gap: 8 }}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          aria-label={`验证码第 ${i + 1} 位`}
          style={{
            flex: '1 1 0',
            minWidth: 0,
            maxWidth: size === 'lg' ? 48 : 40,
            height: h,
            textAlign: 'center',
            fontSize: fs,
            fontWeight: 600,
            border: `1.5px solid ${value[i] ? TOKENS.primary : TOKENS.border}`,
            borderRadius: 8,
            outline: 'none',
            background: disabled
              ? TOKENS.bgAlt
              : value[i]
                ? TOKENS.primarySoft
                : '#fff',
            color: TOKENS.text,
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            transition: 'border-color .15s, background .15s',
            boxSizing: 'border-box',
            padding: 0,
          }}
        />
      ))}
    </div>
  );
}
