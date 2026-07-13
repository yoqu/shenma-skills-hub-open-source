import { TOKENS } from '@/lib/tokens';
import { I } from '@/components/icons';
import type { Suite } from '@/mocks/suites';

export interface SuiteListProps {
  suites: Suite[];
  selected: Suite | null;
  setSelected: (s: Suite) => void;
}

export function SuiteList({ suites, selected, setSelected }: SuiteListProps) {
  return (
    <div
      style={{
        borderRight: `1px solid ${TOKENS.border}`,
        background: '#fff',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          fontSize: 11,
          color: TOKENS.text3,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          borderBottom: `1px solid ${TOKENS.borderSoft}`,
        }}
      >
        我的套件
      </div>
      {suites.map((s) => {
        const active = selected?.id === s.id;
        return (
          <div
            key={s.id}
            onClick={() => setSelected(s)}
            style={{
              padding: '14px 16px',
              cursor: 'pointer',
              borderBottom: `1px solid ${TOKENS.borderSoft}`,
              background: active ? TOKENS.primarySoft : 'transparent',
              borderLeft: active
                ? `3px solid ${TOKENS.primary}`
                : '3px solid transparent',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <I.layers size={13} style={{ color: TOKENS.primary }} />
              <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{s.name}</div>
              {s.visibility === 'PUBLIC' ? (
                <I.globe size={11} style={{ color: TOKENS.text3 }} />
              ) : (
                <I.lock size={11} style={{ color: TOKENS.text3 }} />
              )}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: TOKENS.text3,
                marginBottom: 6,
                lineHeight: 1.5,
              }}
            >
              {s.desc}
            </div>
            <div
              style={{
                display: 'flex',
                gap: 10,
                fontSize: 11,
                color: TOKENS.text3,
              }}
            >
              <span>{s.skills} Skill</span>
              <span>·</span>
              <span>{s.installs} 安装</span>
              <span style={{ marginLeft: 'auto' }}>{s.updated.slice(5)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
