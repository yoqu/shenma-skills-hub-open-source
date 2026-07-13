import { Fragment } from 'react';
import { TOKENS } from '@/lib/tokens';
import { I } from '@/components/icons';

export function StepIndicator({ steps, step }: { steps: string[]; step: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28 }}>
      {steps.map((s, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <Fragment key={s}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: done ? TOKENS.primary : active ? TOKENS.primarySoft : '#fff',
                  border: `1px solid ${done || active ? TOKENS.primary : TOKENS.border}`,
                  color: done ? '#fff' : active ? TOKENS.primary : TOKENS.text3,
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {done ? <I.check size={12} stroke={3} /> : n}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  color: active ? TOKENS.text : done ? TOKENS.text2 : TOKENS.text3,
                }}
              >
                {s}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: done ? TOKENS.primary : TOKENS.border,
                  margin: '0 2px',
                }}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
