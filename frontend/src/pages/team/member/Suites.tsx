import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { fmt } from '@/lib/utils';
import { Badge, Button, Card, CopyButton, DashTopBar, SectionHeader, SkillIcon, toast } from '@/components/ui';
import { I } from '@/components/icons';
import { mapSkill, useSuites, useTeam } from '@/api/data';
import { useCurrentTeam } from '@/hooks/useCurrentTeam';
import { suiteApi } from '@/api/endpoints';
import type { Suite } from '@/mocks/suites';
import { MemberShell } from './_shared/MemberShell';

export default function Suites() {
  const { data: suites = [] } = useSuites({ size: 20 });
  const [selected, setSelected] = useState<Suite | null>(null);

  useEffect(() => {
    if (!selected && suites.length > 0) setSelected(suites[0]);
  }, [selected, suites]);

  return (
    <MemberShell active="suites">
      <DashTopBar
        title="套件"
        hint={`${suites.length} 个团队套件 · 一键安装管理员沉淀的 Skill 组合`}
      />
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '300px 1fr',
          overflow: 'hidden',
        }}
      >
        <SuiteList suites={suites} selected={selected} setSelected={setSelected} />
        {selected && <SuiteViewer suite={selected} />}
      </div>
    </MemberShell>
  );
}

function SuiteList({
  suites,
  selected,
  setSelected,
}: {
  suites: Suite[];
  selected: Suite | null;
  setSelected: (s: Suite) => void;
}) {
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
        团队套件
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
              style={{ display: 'flex', gap: 10, fontSize: 11, color: TOKENS.text3 }}
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

function SuiteViewer({ suite }: { suite: Suite }) {
  const { teamSlug, teamId } = useCurrentTeam(true);
  const { data: team } = useTeam();
  const effectiveTeamSlug = teamSlug || team?.slug || '';
  const teamIdNum = teamId ? Number(teamId) : undefined;
  const { data: detail } = useQuery({
    queryKey: ['suite-detail', teamIdNum, suite.slug],
    queryFn: () => suiteApi.detailByTeamSlug(teamIdNum!, suite.slug),
    enabled: !!teamIdNum,
  });
  const items: Array<ReturnType<typeof mapSkill>> = Array.isArray((detail as any)?.skills)
    ? (detail as any).skills.map(mapSkill)
    : [];
  const installSuite = useMutation({
    mutationFn: () => suiteApi.install(Number(suite.id)),
    onSuccess: () => {
      toast({ kind: 'success', message: `套件「${suite.name}」已安装` });
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `安装失败：${err.message}` : '安装失败，请稍后重试',
      });
    },
  });

  return (
    <div
      style={{
        overflow: 'auto',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <Card pad={18}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${TOKENS.primary}, #7C3AED)`,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              flex: '0 0 auto',
            }}
          >
            <I.layers size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <b style={{ fontSize: 18 }}>{suite.name}</b>
              <Badge
                tone={suite.visibility === 'PUBLIC' ? 'success' : 'info'}
                size="sm"
              >
                {suite.visibility === 'PUBLIC' ? '公开' : '团队私有'}
              </Badge>
            </div>
            <div
              style={{
                fontSize: 13,
                color: TOKENS.text2,
                marginTop: 6,
                lineHeight: 1.55,
              }}
            >
              {suite.desc}
            </div>
            <div
              style={{
                display: 'flex',
                gap: 16,
                fontSize: 12,
                color: TOKENS.text3,
                marginTop: 10,
              }}
            >
              <span>{suite.skills} 个 Skill</span>
              <span>{fmt(suite.installs)} 安装</span>
              <span>更新 {suite.updated}</span>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              alignItems: 'flex-end',
            }}
          >
            <Button
              variant="primary"
              size="md"
              icon={<I.download size={14} />}
              disabled={installSuite.isPending}
              onClick={() => installSuite.mutate()}
            >
              {installSuite.isPending ? '安装中…' : '一键安装套件'}
            </Button>
            <CopyButton
              text={`skillstack install --suite ${effectiveTeamSlug}/${suite.slug}`}
              label="复制命令"
              successMessage="安装命令已复制"
            />
          </div>
        </div>
      </Card>

      <Card pad={0}>
        <div
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            borderBottom: `1px solid ${TOKENS.borderSoft}`,
          }}
        >
          <b style={{ fontSize: 13 }}>套件包含的 Skill</b>
        </div>
        {items.map((s, i: number) => {
          return (
            <div
              key={s.slug}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 1.6fr 1.4fr 90px 80px',
                padding: '12px 18px',
                alignItems: 'center',
                fontSize: 12.5,
                gap: 8,
                borderBottom:
                  i < items.length - 1 ? `1px solid ${TOKENS.borderSoft}` : 'none',
              }}
            >
              <SkillIcon ch={s.icon} cat={s.cat} url={s.iconUrl} size={32} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: TOKENS.text }}>{s.name}</div>
                <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 2 }}>
                  v{s.version} · {s.author.name}
                </div>
              </div>
              <div
                style={{
                  color: TOKENS.text2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.short}
              </div>
              <span
                style={{
                  color: TOKENS.text3,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <I.download size={11} /> {fmt(s.installs)}
              </span>
              <Button
                variant="secondary"
                size="sm"
                style={{ height: 26, fontSize: 11 }}
              >
                安装
              </Button>
            </div>
          );
        })}
      </Card>

      <Card pad={18}>
        <SectionHeader
          title="安装说明"
          hint="复制命令到本地终端,或交给团队设备脚本统一执行"
        />
        <pre
          style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 12.5,
            background: TOKENS.text,
            color: '#A5B4FC',
            padding: 14,
            borderRadius: 8,
            margin: 0,
            overflow: 'auto',
            lineHeight: 1.6,
          }}
        >{`# 一键安装 "${suite.name}"
skillstack install --suite ${effectiveTeamSlug}/${suite.slug}

# 或挑选其中部分 Skill
skillstack install ${effectiveTeamSlug}/${suite.slug}@${items[0]?.slug || 'first'}`}</pre>
      </Card>
    </div>
  );
}
