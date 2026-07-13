import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { TOKENS } from '@/lib/tokens';
import { fmt } from '@/lib/utils';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DashTopBar,
  EmptyState,
  Input,
  Select,
  SkillIcon,
  toast,
  type BadgeTone,
} from '@/components/ui';
import { Tabs } from '@/components/chrome';
import { I } from '@/components/icons';
import { useTeamSkills, useTeamMembers } from '@/api/data';
import { skillApi } from '@/api/endpoints';
import { useCurrentTeam } from '@/hooks/useCurrentTeam';
import type { Skill, SkillStatus } from '@/mocks/skills';
import { AdminShell } from './_shared/AdminShell';
import { SkillEditDrawer } from './Skills/SkillEditDrawer';
import { AdminSubmitVersionModal } from './Skills/AdminSubmitVersionModal';

type VisFilter = 'all' | 'APPROVED' | 'UNLISTED';

const STATUS_TONE: Record<SkillStatus, { tone: BadgeTone; label: string }> = {
  APPROVED: { tone: 'success', label: '已发布' },
  PENDING_REVIEW: { tone: 'warning', label: '待审核' },
  DRAFT: { tone: 'neutral', label: '草稿' },
  REJECTED: { tone: 'danger', label: '已拒绝' },
  UNLISTED: { tone: 'neutral', label: '已下架' },
};

// 审核中 / 草稿 / 已拒绝 不再写入 skills 表，因此管理员视角只筛选已发布 / 已下架。
const STATUS_OPTIONS = [
  { value: '', label: '状态：全部' },
  { value: 'APPROVED', label: '状态：已发布' },
  { value: 'UNLISTED', label: '状态：已下架' },
];
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

interface Filters {
  status: SkillStatus | '';
  cat: string;
  authorId?: number;
  updatedWithin: number;
}

export default function AdminSkills() {
  const nav = useNavigate();
  const [vis, setVis] = useState<VisFilter>('all');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Filters>({ status: '', cat: '', authorId: undefined, updatedWithin: 0 });
  const [editing, setEditing] = useState<Skill | null>(null);
  const [submittingVersion, setSubmittingVersion] = useState<Skill | null>(null);

  // Skill 库现在只装 APPROVED / UNLISTED。tab 直接对应 status 过滤。
  const skillsQuery = useTeamSkills({
    status: vis === 'APPROVED' || vis === 'UNLISTED' ? vis : filters.status || undefined,
    cat: filters.cat || undefined,
    authorId: filters.authorId,
    updatedWithin: filters.updatedWithin || undefined,
    q: q || undefined,
    size: 50,
  });
  const skills = skillsQuery.data ?? [];

  const tabs = [
    { id: 'all', label: '全部', count: skills.length },
    {
      id: 'APPROVED',
      label: '已发布',
      count: skills.filter((s) => s.status === 'APPROVED').length,
    },
    {
      id: 'UNLISTED',
      label: '已下架',
      count: skills.filter((s) => s.status === 'UNLISTED').length,
    },
  ];

  return (
    <AdminShell active="skills">
      <DashTopBar
        title="Skill 库"
        hint={`共 ${skills.length} 个 Skill · ${skills.filter((s) => s.status === 'APPROVED').length} 个已发布 · ${skills.filter((s) => s.status === 'UNLISTED').length} 个已下架`}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<I.plus size={12} />}
            onClick={() => nav('/create/skill')}
          >
            新建 Skill
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
        <Tabs tabs={tabs} active={vis} onChange={(id) => setVis(id as VisFilter)} />
      </div>

      <FilterBar q={q} setQ={setQ} filters={filters} setFilters={setFilters} />

      <div style={{ padding: '16px 32px 32px', overflow: 'auto' }}>
        <Card pad={0}>
          {skillsQuery.isError ? (
            <EmptyState
              icon={<I.x size={20} />}
              title="Skill 列表加载失败"
              hint={skillsQuery.error instanceof Error ? skillsQuery.error.message : '请稍后重试'}
              action={
                <Button variant="secondary" size="sm" onClick={() => skillsQuery.refetch()}>
                  重试
                </Button>
              }
            />
          ) : skillsQuery.isLoading ? (
            <EmptyState
              icon={<I.clock size={20} />}
              title="正在加载 Skill 列表…"
              hint="如果一直加载请检查后端服务是否正常"
            />
          ) : skills.length === 0 ? (
            <EmptyState
              title={q ? '未匹配到 Skill' : '团队还没有 Skill'}
              hint={q ? '换个关键词试试，或者清空搜索' : '点击右上角「新建 Skill」开始'}
              action={
                !q ? (
                  <Button variant="primary" size="sm" onClick={() => nav('/create/skill')}>
                    新建 Skill
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <SkillsTable
              list={skills}
              onEdit={(s) => setEditing(s)}
              onSubmitVersion={(s) => setSubmittingVersion(s)}
            />
          )}
        </Card>
      </div>

      {editing && <SkillEditDrawer skill={editing} onClose={() => setEditing(null)} />}
      {submittingVersion && (
        <AdminSubmitVersionModal
          skill={submittingVersion}
          onClose={() => setSubmittingVersion(null)}
        />
      )}
    </AdminShell>
  );
}

function FilterBar({
  q,
  setQ,
  filters,
  setFilters,
}: {
  q: string;
  setQ: (v: string) => void;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
}) {
  return (
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
        <I.search size={14} style={{ position: 'absolute', left: 11, top: 9, color: TOKENS.text3 }} />
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
        value={filters.status}
        options={STATUS_OPTIONS}
        onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as SkillStatus | '' }))}
        style={filterSelectStyle(Boolean(filters.status))}
      />
      <Select
        value={filters.cat}
        options={CAT_OPTIONS}
        onChange={(e) => setFilters((f) => ({ ...f, cat: e.target.value }))}
        style={filterSelectStyle(Boolean(filters.cat))}
      />
      <AuthorFilter
        value={filters.authorId}
        onChange={(authorId) => setFilters((f) => ({ ...f, authorId }))}
      />
      <Select
        value={String(filters.updatedWithin)}
        options={TIME_OPTIONS}
        onChange={(e) => setFilters((f) => ({ ...f, updatedWithin: Number(e.target.value) }))}
        style={filterSelectStyle(filters.updatedWithin > 0)}
      />
    </div>
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

function menuStyle(): React.CSSProperties {
  return {
    background: '#fff',
    border: `1px solid ${TOKENS.border}`,
    borderRadius: 6,
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
    padding: 4,
    minWidth: 140,
    fontSize: 12.5,
    zIndex: 50,
  };
}
function menuItemStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
    padding: '6px 10px',
    borderRadius: 4,
    cursor: 'pointer',
    color: TOKENS.text,
    background: active ? TOKENS.bgAlt : 'transparent',
    outline: 'none',
  };
}

function AuthorFilter({
  value,
  onChange,
}: {
  value?: number;
  onChange: (id: number | undefined) => void;
}) {
  const members = useTeamMembers({ page: 1, size: 100 });
  const list = (members.data ?? []) as (ReturnType<typeof Object> & {
    userId?: number;
    handle: string;
    name: string;
  })[];
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

function SkillsTable({
  list,
  onEdit,
  onSubmitVersion,
}: {
  list: Skill[];
  onEdit: (s: Skill) => void;
  onSubmitVersion: (s: Skill) => void;
}) {
  const cols = '32px 2.2fr 110px 130px 1fr 110px 110px 100px 28px';
  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: cols,
          padding: '10px 16px',
          fontSize: 11,
          color: TOKENS.text3,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          borderBottom: `1px solid ${TOKENS.borderSoft}`,
          background: TOKENS.bgAlt,
        }}
      >
        <span />
        <span>Skill</span>
        <span>可见性</span>
        <span>状态</span>
        <span>作者</span>
        <span>版本</span>
        <span>安装数</span>
        <span>更新</span>
        <span />
      </div>
      {list.map((s, i) => (
        <SkillRow
          key={s.slug}
          s={s}
          cols={cols}
          isLast={i === list.length - 1}
          onEdit={onEdit}
          onSubmitVersion={onSubmitVersion}
        />
      ))}
    </div>
  );
}

function SkillRow({
  s,
  cols,
  isLast,
  onEdit,
  onSubmitVersion,
}: {
  s: Skill;
  cols: string;
  isLast: boolean;
  onEdit: (s: Skill) => void;
  onSubmitVersion: (s: Skill) => void;
}) {
  const nav = useNavigate();
  const st = STATUS_TONE[s.status];
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`查看 ${s.name} 详情`}
      onClick={() => nav(`/skills/${s.slug}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          nav(`/skills/${s.slug}`);
        }
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: cols,
        padding: '12px 16px',
        alignItems: 'center',
        fontSize: 12.5,
        borderBottom: isLast ? 'none' : `1px solid ${TOKENS.borderSoft}`,
        cursor: 'pointer',
      }}
    >
      <span />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
        <SkillIcon ch={s.icon} cat={s.cat} url={s.iconUrl} size={28} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              color: TOKENS.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {s.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: TOKENS.text3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 2,
            }}
          >
            {s.short}
          </div>
        </div>
      </div>
      <Badge tone={s.visibility === 'PUBLIC' ? 'primary' : 'info'} size="sm">
        {s.visibility === 'PUBLIC' ? (
          <>
            <I.globe size={10} /> 公开
          </>
        ) : (
          <>
            <I.lock size={10} /> 私有
          </>
        )}
      </Badge>
      <Badge tone={st.tone} size="sm">
        {st.label}
      </Badge>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Avatar name={s.author.name} char={s.author.name.slice(0, 1)} size={20} />
        <span style={{ color: TOKENS.text2 }}>{s.author.name}</span>
      </div>
      <span style={{ fontFamily: 'monospace', color: TOKENS.text2, fontSize: 11.5 }}>v{s.version}</span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          whiteSpace: 'nowrap',
          color: TOKENS.text2,
        }}
      >
        <I.download size={11} /> {fmt(s.installs)}
      </span>
      <span style={{ color: TOKENS.text3, fontSize: 11.5 }}>{s.updated.slice(5)}</span>
      <RowMenu s={s} onEdit={onEdit} onSubmitVersion={onSubmitVersion} />
    </div>
  );
}

function RowMenu({
  s,
  onEdit,
  onSubmitVersion,
}: {
  s: Skill;
  onEdit: (s: Skill) => void;
  onSubmitVersion: (s: Skill) => void;
}) {
  const { teamId } = useCurrentTeam();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['team-skills', teamId] });
  const id = s.id;

  const visMut = useMutation({
    mutationFn: (v: 'PUBLIC' | 'TEAM_PRIVATE') => skillApi.updateVisibility(id!, v),
    onSuccess: () => {
      toast({ kind: 'success', message: '已更新可见性' });
      invalidate();
    },
    onError: (e) =>
      toast({ kind: 'error', message: e instanceof Error ? e.message : '更新可见性失败' }),
  });
  const statusMut = useMutation({
    mutationFn: (st: 'APPROVED' | 'UNLISTED') => skillApi.updateStatus(id!, st),
    onSuccess: () => {
      toast({ kind: 'success', message: '已更新状态' });
      invalidate();
    },
    onError: (e) =>
      toast({ kind: 'error', message: e instanceof Error ? e.message : '更新状态失败' }),
  });
  const delMut = useMutation({
    mutationFn: () => skillApi.remove(id!),
    onSuccess: () => {
      toast({ kind: 'success', message: '已删除' });
      invalidate();
    },
    onError: (e) =>
      toast({ kind: 'error', message: e instanceof Error ? e.message : '删除失败' }),
  });

  if (!id) {
    return (
      <Button variant="ghost"
        type="button"
        disabled
        title="无 ID，无法操作"
        aria-label="操作不可用"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'not-allowed',
          color: TOKENS.text3,
          opacity: 0.5,
        }}
      >
        <I.more size={14} />
      </Button>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost"
          type="button"
          aria-label={`${s.name} 的更多操作`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: TOKENS.text3,
            padding: 2,
          }}
        >
          <I.more size={14} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={4}
          align="end"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          style={menuStyle()}
        >
          <DropdownMenu.Item onSelect={() => onEdit(s)} style={menuItemStyle(false)}>
            <I.cog size={11} /> 编辑信息
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => onSubmitVersion(s)} style={menuItemStyle(false)}>
            <I.layers size={11} /> 提交新版本
          </DropdownMenu.Item>
          {s.visibility === 'PUBLIC' ? (
            <DropdownMenu.Item
              onSelect={() => visMut.mutate('TEAM_PRIVATE')}
              style={menuItemStyle(false)}
            >
              <I.lock size={11} /> 改为团队私有
            </DropdownMenu.Item>
          ) : (
            <DropdownMenu.Item
              onSelect={() => visMut.mutate('PUBLIC')}
              style={menuItemStyle(false)}
            >
              <I.globe size={11} /> 改为公开
            </DropdownMenu.Item>
          )}
          {s.status === 'APPROVED' && (
            <DropdownMenu.Item
              onSelect={() => statusMut.mutate('UNLISTED')}
              style={menuItemStyle(false)}
            >
              <I.arrowDn size={11} /> 下架
            </DropdownMenu.Item>
          )}
          {s.status === 'UNLISTED' && (
            <DropdownMenu.Item
              onSelect={() => statusMut.mutate('APPROVED')}
              style={menuItemStyle(false)}
            >
              <I.arrowUp size={11} /> 重新上架
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Separator
            style={{ height: 1, background: TOKENS.borderSoft, margin: '4px 0' }}
          />
          <DropdownMenu.Item
            onSelect={() => {
              if (window.confirm(`确认删除 Skill「${s.name}」？删除后不可在团队库内查看。`)) {
                delMut.mutate();
              }
            }}
            style={{ ...menuItemStyle(false), color: TOKENS.danger }}
          >
            <I.trash size={11} /> 删除
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
