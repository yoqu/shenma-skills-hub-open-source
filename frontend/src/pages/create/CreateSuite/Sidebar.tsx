import { TOKENS } from '@/lib/tokens';
import { Card } from '@/components/ui';
import type { Skill } from '@/mocks/skills';
import { SuitePicker } from './SuitePicker';

export interface SuiteSidebarProps {
  teamId?: number;
  available: Skill[];
  onAdd: (s: Skill) => void;
  count: number;
  slug: string;
}

export function SuiteSidebar({ available, onAdd, count, slug, teamId }: SuiteSidebarProps) {
  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        alignSelf: 'flex-start',
        position: 'sticky',
        top: 16,
      }}
    >
      <SuitePicker available={available} onAdd={onAdd} />
      <Card pad={14}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: TOKENS.text2,
            marginBottom: 8,
          }}
        >
          预览安装命令
        </div>
        <div
          style={{
            padding: '10px 12px',
            background: '#0F172A',
            color: '#E2E8F0',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 12,
            borderRadius: 6,
          }}
        >
          <span style={{ color: '#A78BFA' }}>$</span> smskill suite install{' '}
          <span style={{ color: '#86EFAC' }}>
            {teamId ?? '<teamId>'}/{slug || 'your-slug'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 8 }}>
          {count} 个 Skill · 预计 ≈ {Math.round(count * 4.5)}s · 在所有团队成员的 CLI 上可用
        </div>
      </Card>
    </aside>
  );
}
