import { TOKENS } from '@/lib/tokens';
import { Avatar, Badge, EmptyState, SkillIcon } from '@/components/ui';
import { I } from '@/components/icons';
import type { Review } from '@/mocks/reviews';

export interface ReviewListProps {
  list: Review[];
  selected: Review | null;
  setSelected: (r: Review) => void;
}

export function ReviewList({ list, selected, setSelected }: ReviewListProps) {
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
        {list.length} 项 · 按提交时间倒序
      </div>
      {list.length === 0 && (
        <EmptyState
          icon={<I.inbox size={20} />}
          title="审核队列已清空"
          hint="当前没有等待审核的资产"
        />
      )}
      {list.map((r) => {
        const active = selected !== null && selected.id === r.id;
        return (
          <div
            key={r.id}
            onClick={() => setSelected(r)}
            style={{
              display: 'flex',
              gap: 12,
              padding: '14px 16px',
              cursor: 'pointer',
              background: active ? TOKENS.primarySoft : 'transparent',
              borderBottom: `1px solid ${TOKENS.borderSoft}`,
              borderLeft: active
                ? `3px solid ${TOKENS.primary}`
                : '3px solid transparent',
            }}
          >
            {r.targetType === 'PROMPT' ? (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: TOKENS.bgGray,
                  color: TOKENS.primary,
                  display: 'grid',
                  placeItems: 'center',
                  flex: '0 0 auto',
                }}
              >
                <I.code size={16} />
              </div>
            ) : (
              <SkillIcon ch={r.name.slice(-1).toUpperCase()} size={36} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Badge tone={r.targetType === 'PROMPT' ? 'primary' : 'neutral'} size="sm">
                  {r.targetType === 'PROMPT' ? 'Prompt' : 'Skill'}
                </Badge>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: TOKENS.text,
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.name}
                </div>
                {r.changelog && (
                  <Badge
                    tone="primary"
                    size="sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
                  >
                    <I.layers size={9} /> 新版本
                  </Badge>
                )}
                {r.status === 'REJECTED' && (
                  <Badge tone="danger" size="sm">
                    已拒绝
                  </Badge>
                )}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: TOKENS.text3,
                  marginTop: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.short}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <Avatar
                  name={r.submittedBy.name}
                  char={r.submittedBy.avatar}
                  url={r.submittedBy.avatarUrl}
                  size={18}
                />
                <span style={{ fontSize: 11.5, color: TOKENS.text2 }}>
                  {r.submittedBy.name}
                </span>
                <span style={{ fontSize: 11, color: TOKENS.text3 }}>
                  · {r.submittedAt}
                </span>
                <Badge
                  tone={
                    r.safety === 'pass'
                      ? 'success'
                      : r.safety === 'warn'
                        ? 'warning'
                        : 'danger'
                  }
                  size="sm"
                  style={{ marginLeft: 'auto', fontSize: 10 }}
                >
                  {r.safety === 'pass'
                    ? '✓ 安全'
                    : r.safety === 'warn'
                      ? '! 警告'
                      : '✗ 风险'}
                </Badge>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
