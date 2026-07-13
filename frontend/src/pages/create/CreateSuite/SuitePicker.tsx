import { useState, type CSSProperties } from 'react';
import { TOKENS } from '@/lib/tokens';
import { Card, SearchInput, SectionHeader, SkillIcon } from '@/components/ui';
import { I } from '@/components/icons';
import { fmt } from '@/lib/utils';
import type { Skill } from '@/mocks/skills';

const ROW_BASE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 10px',
  borderRadius: 6,
  cursor: 'pointer',
  background: 'transparent',
};

export interface SuitePickerProps {
  available: Skill[];
  onAdd: (s: Skill) => void;
}

export function SuitePicker({ available, onAdd }: SuitePickerProps) {
  const [q, setQ] = useState('');
  const filtered = available.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Card pad={16}>
      <SectionHeader title="添加 Skill" hint={`${available.length} 个可选 · 团队 Skill 库`} />
      <div style={{ marginBottom: 10 }}>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索 Skill…"
          style={{ height: 30, fontSize: 12, borderRadius: 6 }}
        />
      </div>
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 380, overflow: 'auto' }}
      >
        {filtered.map((s) => (
          <div
            key={s.slug}
            onClick={() => onAdd(s)}
            onMouseEnter={(e) => (e.currentTarget.style.background = TOKENS.bgAlt)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            style={ROW_BASE}
          >
            <SkillIcon ch={s.icon} cat={s.cat} url={s.iconUrl} size={26} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.name}
              </div>
              {s.short && (
                <div
                  style={{
                    fontSize: 11,
                    color: TOKENS.text2,
                    marginTop: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.short}
                </div>
              )}
              <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 1 }}>
                {fmt(s.installs)} · v{s.version}
              </div>
            </div>
            <I.plus size={14} style={{ color: TOKENS.primary }} />
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: TOKENS.text3 }}>
            没有匹配的 Skill
          </div>
        )}
      </div>
    </Card>
  );
}
