import { useEffect, useState } from 'react';
import { TOKENS } from '@/lib/tokens';
import { Button, OtpInput } from '@/components/ui';
import { authApi } from '@/api/endpoints';
import type { RegisterState } from './types';

export interface Step2Props {
  state: RegisterState;
  update: (patch: Partial<RegisterState>) => void;
  submitting?: boolean;
  onBack: () => void;
  onNext: () => void;
}

export function Step2Verify({ state, update, submitting = false, onBack, onNext }: Step2Props) {
  const { code } = state;
  const [countdown, setCountdown] = useState(60);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    if (countdown <= 0) return;
    const id = window.setInterval(() => {
      setCountdown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [countdown]);

  async function resend() {
    if (countdown > 0 || resending) return;
    setResending(true);
    setResendError('');
    try {
      await authApi.smsCode(state.phone);
      setCountdown(60);
    } catch (e) {
      setResendError(e instanceof Error ? e.message : '重新发送失败');
    } finally {
      setResending(false);
    }
  }

  const canResend = countdown <= 0 && !resending;
  const canNext = code.every((c) => /^\d$/.test(c)) && !submitting;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <OtpInput
        value={code}
        onChange={(next) => update({ code: next })}
        onComplete={() => onNext()}
        disabled={submitting}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          fontSize: 12.5,
          color: TOKENS.text3,
        }}
      >
        <span>
          {canResend ? '可重新发送验证码' : resending ? '发送中…' : `${countdown} 秒后可重新发送`}
        </span>
        <Button variant="ghost"
          type="button"
          onClick={canResend ? resend : undefined}
          disabled={!canResend}
          aria-disabled={!canResend}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            color: canResend ? TOKENS.primary : TOKENS.text3,
            cursor: canResend ? 'pointer' : 'not-allowed',
            fontSize: 12.5,
            fontWeight: canResend ? 500 : 400,
            fontFamily: 'inherit',
          }}
        >
          重新发送
        </Button>
      </div>
      {resendError && (
        <div role="alert" style={{ fontSize: 12, color: TOKENS.danger }}>{resendError}</div>
      )}
      <Button
        type="submit"
        variant={canNext ? 'primary' : 'secondary'}
        size="lg"
        full
        disabled={!canNext}
        aria-disabled={!canNext}
        style={!canNext ? { color: TOKENS.text3, cursor: 'not-allowed' } : undefined}
      >
        {submitting ? '验证中…' : canNext ? '验证并继续' : '请输入 6 位验证码'}
      </Button>
      <Button variant="ghost"
        type="button"
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: TOKENS.text3,
          fontSize: 12.5,
          cursor: 'pointer',
          textAlign: 'center',
          padding: 4,
          fontFamily: 'inherit',
        }}
      >
        ← 上一步
      </Button>
    </div>
  );
}
