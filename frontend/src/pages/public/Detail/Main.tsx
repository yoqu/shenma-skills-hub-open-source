import { useState } from 'react';
import { TOKENS } from '@/lib/tokens';
import { fmt } from '@/lib/utils';
import { Badge, Card } from '@/components/ui';
import { Button, EmptyState } from '@/components/ui';
import { I } from '@/components/icons';
import type { Skill } from '@/mocks/skills';
import type { BadgeTone } from '@/components/ui';
import { OverviewTab } from './Overview';
import { InstallTabPanel } from './Install';
import { CommentsModule } from './Comments';
import { FilesPanel } from './FilesPanel';
import type { InstallTab, SkillVersion } from './types';

const SAFETY_BADGE: Record<'pass' | 'warn' | 'fail', { tone: BadgeTone; label: string }> = {
  pass: { tone: 'success', label: '✓ 安全' },
  warn: { tone: 'warning', label: '! 警告' },
  fail: { tone: 'danger', label: '✗ 风险' },
};

function VersionRow({
  v,
  current,
  onSelect,
}: {
  v: SkillVersion;
  current: string;
  onSelect: () => void;
}) {
  const active = current === v.version;
  const [expanded, setExpanded] = useState(false);
  const hasMoreChangelog =
    !!v.changelog && v.changelog.trim() !== (v.note ?? '').trim();
  const safety = v.safety ? SAFETY_BADGE[v.safety] : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 14px',
        background: active ? TOKENS.primarySoft : 'transparent',
        borderRadius: 6,
        border: active ? `1px solid ${TOKENS.primary}33` : '1px solid transparent',
        gap: expanded ? 10 : 0,
      }}
    >
      <div
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            minWidth: 56,
            height: 22,
            padding: '0 6px',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 4,
            background: active ? TOKENS.primary : TOKENS.bgGray,
            color: active ? '#fff' : TOKENS.text2,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace',
          }}
        >
          v{v.version}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              color: TOKENS.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {v.note || <span style={{ color: TOKENS.text3 }}>（无变更说明）</span>}
          </div>
          <div
            style={{
              fontSize: 11,
              color: TOKENS.text3,
              marginTop: 2,
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <span>{v.date || '—'}</span>
            {v.author && <span>· {v.author}</span>}
            {typeof v.filesCount === 'number' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <I.code size={10} /> {v.filesCount} 文件
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <I.download size={10} /> {fmt(v.installs ?? 0)}
            </span>
            {typeof v.evalScore === 'number' && v.evalScore > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <I.shield size={10} /> {v.evalScore}/100
              </span>
            )}
          </div>
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}
        >
          {safety && (
            <Badge tone={safety.tone} size="sm" style={{ fontSize: 10 }}>
              {safety.label}
            </Badge>
          )}
          {v.latest && (
            <Badge tone="success" size="sm">
              latest
            </Badge>
          )}
          {hasMoreChangelog && (
            <Button variant="ghost"
              type="button"
              aria-label={expanded ? '折叠版本说明' : '展开版本说明'}
              aria-expanded={expanded}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((x) => !x);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: TOKENS.text3,
                padding: 4,
                display: 'inline-flex',
                alignItems: 'center',
                transform: expanded ? 'rotate(180deg)' : 'none',
                transition: 'transform .15s',
              }}
            >
              <I.chev size={12} />
            </Button>
          )}
        </div>
      </div>

      {expanded && hasMoreChangelog && v.changelog && (
        <div
          style={{
            marginLeft: 68,
            padding: 10,
            background: '#fff',
            border: `1px solid ${TOKENS.borderSoft}`,
            borderRadius: 6,
            fontSize: 12,
            color: TOKENS.text2,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {v.changelog}
        </div>
      )}
    </div>
  );
}

export function DetailMain({
  tab,
  installTabs,
  installTab,
  setInstallTab,
  versions,
  versionsLoading = false,
  versionsError = false,
  onVersionsRetry,
  version,
  setVersion,
  skill,
}: {
  tab: string;
  installTabs: InstallTab[];
  installTab: InstallTab['id'];
  setInstallTab: (id: InstallTab['id']) => void;
  versions: SkillVersion[];
  versionsLoading?: boolean;
  versionsError?: boolean;
  onVersionsRetry?: () => void;
  version: string;
  setVersion: (v: string) => void;
  skill: Skill;
}) {
  return (
    <main style={{ minWidth: 0 }}>
      {tab === 'overview' && (
        <>
          <OverviewTab skill={skill} version={version} />
          <CommentsModule versions={versions} skill={skill} />
        </>
      )}
      {tab === 'install' && (
        <InstallTabPanel
          installTabs={installTabs}
          installTab={installTab}
          setInstallTab={setInstallTab}
          version={version}
          skill={skill}
        />
      )}
      {tab === 'history' && (
        <Card pad={14}>
          {versionsError ? (
            <EmptyState
              icon={<I.x size={20} />}
              title="版本历史加载失败"
              hint="请稍后重试，或检查网络连接"
              action={
                onVersionsRetry && (
                  <Button variant="secondary" size="sm" onClick={onVersionsRetry}>
                    重试
                  </Button>
                )
              }
            />
          ) : versionsLoading ? (
            <EmptyState icon={<I.clock size={20} />} title="正在加载版本历史…" />
          ) : versions.length === 0 ? (
            <EmptyState
              icon={<I.layers size={20} />}
              title="还没有发布过版本"
              hint="作者发布并审核通过后会出现在这里"
            />
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 12,
                  color: TOKENS.text3,
                  marginBottom: 8,
                  padding: '0 6px',
                  gap: 8,
                }}
              >
                <span>共 {versions.length} 个版本</span>
                <span>·</span>
                <span>点击版本切换详情视图，▾ 展开完整变更说明</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {versions.map((v) => (
                  <VersionRow
                    key={v.id ?? v.version}
                    v={v}
                    current={version}
                    onSelect={() => setVersion(v.version)}
                  />
                ))}
              </div>
            </>
          )}
        </Card>
      )}
      {tab === 'files' && (
        <FilesPanel slug={skill.slug} version={version} enabled={tab === 'files'} />
      )}
    </main>
  );
}
