import { TOKENS } from '@/lib/tokens';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange?: (id: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${TOKENS.border}`, gap: 0 }}>
      {tabs.map((t) => (
        <div
          key={t.id}
          onClick={() => onChange?.(t.id)}
          style={{
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            position: 'relative',
            color: active === t.id ? TOKENS.text : TOKENS.text2,
            borderBottom: active === t.id ? `2px solid ${TOKENS.primary}` : '2px solid transparent',
            marginBottom: -1,
          }}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 11,
                color: active === t.id ? TOKENS.primary : TOKENS.text3,
                background: active === t.id ? TOKENS.primarySoft : TOKENS.bgGray,
                padding: '1px 6px',
                borderRadius: 999,
              }}
            >
              {t.count}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
