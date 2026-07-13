import { TOKENS } from '@/lib/tokens';
import { Button, Card, SectionHeader } from '@/components/ui';

const ITEMS: Array<[string, string, string]> = [
  ['转让团队所有权', '将 Owner 角色转交给另一位成员。原 Owner 自动降为 Admin。', '转让'],
  ['归档团队', '团队不可见,所有 Skill 标记为 ARCHIVED。可恢复。', '归档'],
  ['删除团队', '永久删除团队及其所有 Skill、套件、审核记录。不可恢复。', '删除'],
];

export function SettingsDanger() {
  return (
    <Card pad={20} style={{ border: '1px solid #FECACA' }}>
      <SectionHeader title="危险操作" />
      {ITEMS.map(([t, d, btn]) => (
        <div
          key={t}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '14px 0',
            borderTop: `1px solid ${TOKENS.borderSoft}`,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{t}</div>
            <div style={{ fontSize: 12, color: TOKENS.text3, marginTop: 3 }}>{d}</div>
          </div>
          <Button variant="danger" size="sm">
            {btn}
          </Button>
        </div>
      ))}
    </Card>
  );
}
