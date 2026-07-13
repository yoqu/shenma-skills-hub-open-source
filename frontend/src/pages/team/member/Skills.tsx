import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { fmt } from '@/lib/utils';
import { Button, DashTopBar, Input, Select, SkillIcon, toast } from '@/components/ui';
import { Tabs, type TabItem } from '@/components/chrome';
import { I } from '@/components/icons';
import { useTeamSkills, useTeamMembers } from '@/api/data';
import { skillApi } from '@/api/endpoints';
import { useCurrentTeam } from '@/hooks/useCurrentTeam';
import type { Skill, Visibility } from '@/mocks/skills';
import { MemberShell } from './_shared/MemberShell';

type SkillTab = 'all' | Visibility;

const CAT_OPTIONS = [
  { value: '', label: '分类：全部' },
  { value: 'dev', label: '分类：开发' },
  { value: 'data', label: '分类：数据' },
  { value: 'design', label: '分类：设计' },
  { value: 'doc', label: '分类：文档' },
  { value: 'devops', label: '分类：运维' },
  { value: 'ai', label: '分类：AI' },
];
const TIME_OPTIONS = [
  { value: '0', label: '更新时间：全部' },
  { value: '7', label: '更新时间：近 7 天' },
  { value: '30', label: '更新时间：近 30 天' },
  { value: '90', label: '更新时间：近 90 天' },
];

export default function Skills() {
  const nav = useNavigate();
  const [vis, setVis] = useState<SkillTab>('all');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [authorId, setAuthorId] = useState<number | undefined>(undefined);
  const [updatedWithin, setUpdatedWithin] = useState(0);

  const { data: skills = [] } = useTeamSkills({
    visibility: vis === 'PUBLIC' || vis === 'TEAM_PRIVATE' ? vis : undefined,
    cat: cat || undefined,
    authorId,
    updatedWithin: updatedWithin || undefined,
    q: q || undefined,
    size: 50,
  });

  const tabs: TabItem[] = [
    { id: 'all', label: '全部', count: skills.length },
    {
      id: 'PUBLIC',
      label: '公开',
      count: skills.filter((s) => s.visibility === 'PUBLIC').length,
    },
    {
      id: 'TEAM_PRIVATE',
      label: '团队私有',
      count: skills.filter((s) => s.visibility === 'TEAM_PRIVATE').length,
    },
  ];

  return (
    <MemberShell active="skills">
      <DashTopBar
        title="Skill 库"
        hint="浏览团队全部 Skill · 安装命令一键复制"
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<I.plus size={12} />}
            onClick={() => nav('/create/skill')}
          >
            提交 Skill
          </Button>
        }
      />
      <div
        style={{
          background: '#fff',
          borderBottom: `1px solid ${TOKENS.border}`,
          padding: '0 32px',
        }}
      >
        <Tabs tabs={tabs} active={vis} onChange={(id) => setVis(id as SkillTab)} />
      </div>
      <div
        style={{
          padding: '20px 32px',
          background: '#fff',
          borderBottom: `1px solid ${TOKENS.borderSoft}`,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 220, maxWidth: 360, position: 'relative' }}>
          <I.search
            size={14}
            style={{ position: 'absolute', left: 11, top: 9, color: TOKENS.text3 }}
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索 Skill 名称、描述、标签…"
            style={{
              height: 32,
              padding: '0 10px 0 32px',
              fontSize: 12.5,
              background: TOKENS.bgAlt,
              border: `1px solid ${TOKENS.borderSoft}`,
              borderRadius: 6,
            }}
          />
        </div>
        <Select
          value={cat}
          options={CAT_OPTIONS}
          onChange={(e) => setCat(e.target.value)}
          style={filterSelectStyle(Boolean(cat))}
        />
        <AuthorSelect value={authorId} onChange={setAuthorId} />
        <Select
          value={String(updatedWithin)}
          options={TIME_OPTIONS}
          onChange={(e) => setUpdatedWithin(Number(e.target.value))}
          style={filterSelectStyle(updatedWithin > 0)}
        />
        <span style={{ marginLeft: 'auto', fontSize: 12, color: TOKENS.text3 }}>
          {skills.length} 项
        </span>
      </div>
      <div style={{ padding: '20px 32px 32px', overflow: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 14,
          }}
        >
          {skills.map((s) => (
            <MemberSkillCard key={s.slug} skill={s} />
          ))}
        </div>
      </div>
    </MemberShell>
  );
}

function filterSelectStyle(active: boolean): React.CSSProperties {
  return {
    width: 'auto',
    minWidth: 126,
    height: 32,
    padding: '0 30px 0 10px',
    fontSize: 12.5,
    color: active ? TOKENS.primary : TOKENS.text2,
    background: active ? TOKENS.primary + '14' : '#fff',
    border: `1px solid ${active ? TOKENS.primary + '55' : TOKENS.border}`,
  };
}

function AuthorSelect({
  value,
  onChange,
}: {
  value?: number;
  onChange: (id?: number) => void;
}) {
  const members = useTeamMembers({ page: 1, size: 100 });
  const list = (members.data ?? []) as { userId?: number; handle: string; name: string }[];
  return (
    <Select
      value={value === undefined ? '' : String(value)}
      options={[
        { value: '', label: '作者：全部' },
        ...list.map((m) => ({
          value: String(m.userId ?? ''),
          label: `作者：${m.name}`,
          disabled: m.userId === undefined,
        })),
      ]}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      style={filterSelectStyle(value !== undefined)}
    />
  );
}

function MemberSkillCard({ skill }: { skill: Skill }) {
  const { teamId } = useCurrentTeam();
  const qc = useQueryClient();
  const id = skill.id;
  const [starred, setStarred] = useState(false);
  const [stars, setStars] = useState(skill.stars);

  const installMut = useMutation({
    mutationFn: () => skillApi.install(id!),
    onSuccess: () => {
      toast({ kind: 'success', message: `${skill.name} 已添加到我的 Skill` });
      qc.invalidateQueries({ queryKey: ['team-skills', teamId] });
    },
    onError: (err) =>
      toast({
        kind: 'error',
        message: err instanceof Error ? `安装失败：${err.message}` : '安装失败，请稍后重试',
      }),
  });

  const starMut = useMutation({
    mutationFn: (next: boolean) => (next ? skillApi.star(id!) : skillApi.unstar(id!)),
    onMutate: (next) => {
      const prev = { starred, stars };
      setStarred(next);
      setStars((c) => c + (next ? 1 : -1));
      return prev;
    },
    onError: (err, _next, ctx) => {
      if (ctx) {
        setStarred(ctx.starred);
        setStars(ctx.stars);
      }
      toast({ kind: 'error', message: err instanceof Error ? err.message : '操作失败' });
    },
    onSuccess: (res) => {
      if (res && typeof res.stars === 'number') setStars(res.stars);
      if (res && typeof res.starred === 'boolean') setStarred(res.starred);
    },
  });

  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <SkillIcon ch={skill.icon} cat={skill.cat} url={skill.iconUrl} size={40} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: TOKENS.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {skill.name}
            </div>
            {skill.visibility === 'TEAM_PRIVATE' && (
              <I.lock size={12} style={{ color: TOKENS.text3, flex: '0 0 auto' }} />
            )}
          </div>
          <div style={{ fontSize: 11.5, color: TOKENS.text3, marginTop: 2 }}>
            v{skill.version} · {skill.author.name}
          </div>
        </div>
        <Button variant="ghost"
          type="button"
          aria-label={starred ? '取消收藏' : '收藏'}
          onClick={() => {
            if (!id) return;
            starMut.mutate(!starred);
          }}
          disabled={!id}
          style={{
            background: 'none',
            border: 'none',
            cursor: id ? 'pointer' : 'not-allowed',
            color: starred ? TOKENS.primary : TOKENS.text3,
            padding: 2,
          }}
        >
          {starred ? <I.bookmarkFill size={14} /> : <I.bookmark size={14} />}
        </Button>
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: TOKENS.text2,
          lineHeight: 1.55,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          minHeight: 36,
        }}
      >
        {skill.short}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {skill.tags.slice(0, 3).map((t) => (
          <span
            key={t}
            style={{
              fontSize: 11,
              color: TOKENS.text2,
              padding: '2px 7px',
              background: TOKENS.bgGray,
              borderRadius: 4,
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 11.5,
          color: TOKENS.text3,
          paddingTop: 8,
          borderTop: `1px solid ${TOKENS.borderSoft}`,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <I.download size={12} /> {fmt(skill.installs)}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <I.starFill size={12} style={{ color: '#F59E0B' }} /> {stars || '—'}
        </span>
        <Button
          variant="primary"
          size="sm"
          style={{ marginLeft: 'auto', height: 26, fontSize: 11, padding: '0 10px' }}
          onClick={() => id && installMut.mutate()}
          disabled={!id}
        >
          <I.download size={11} /> 安装
        </Button>
      </div>
    </div>
  );
}
