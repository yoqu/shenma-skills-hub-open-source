import { Fragment } from 'react';
import { TOKENS } from '@/lib/tokens';
import { I } from '@/components/icons';
import { CREATE_SKILL_STEP_IMAGE_SRC } from '@/lib/visualAssets';

export interface StepDef {
  id: number;
  label: string;
  hint: string;
}

export interface StepperProps {
  steps: StepDef[];
  current: number;
  setStep: (id: number) => void;
}

export function Stepper({ steps, current, setStep }: StepperProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0,
        background: '#fff',
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      {steps.map((s, i) => {
        const isDone = s.id < current;
        const isActive = s.id === current;
        const image = CREATE_SKILL_STEP_IMAGE_SRC[s.id];
        return (
          <Fragment key={s.id}>
            <div
              onClick={() => isDone && setStep(s.id)}
              style={{
                flex: 1,
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                cursor: isDone ? 'pointer' : 'default',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  flex: '0 0 auto',
                  display: 'grid',
                  placeItems: 'center',
                  background: isActive ? TOKENS.primarySoft : '#fff',
                  border: `1px solid ${isActive ? TOKENS.primary + '33' : TOKENS.borderSoft}`,
                  boxShadow: isActive ? '0 4px 12px rgba(79,70,229,.10)' : 'none',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={image}
                  alt=""
                  aria-hidden="true"
                  width={42}
                  height={42}
                  style={{ display: 'block', width: 42, height: 42, objectFit: 'contain' }}
                />
                {isDone && (
                  <span
                    style={{
                      position: 'absolute',
                      right: 3,
                      bottom: 3,
                      width: 15,
                      height: 15,
                      borderRadius: 999,
                      background: TOKENS.success,
                      color: '#fff',
                      display: 'grid',
                      placeItems: 'center',
                      border: '1px solid #fff',
                    }}
                  >
                    <I.check size={9} stroke={2.5} />
                  </span>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? TOKENS.text : isDone ? TOKENS.text2 : TOKENS.text3,
                  }}
                >
                  {s.label}
                </div>
                <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 2 }}>{s.hint}</div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  height: 2,
                  flex: '0 0 32px',
                  background: isDone ? TOKENS.success : TOKENS.borderSoft,
                  marginTop: 22,
                }}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
