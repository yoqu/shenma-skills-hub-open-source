import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  EmptyState,
  I,
  Pressable,
  SearchInput,
  SectionHeader,
  SkillCard,
  type SkillCardData,
  SkillIcon,
  Skeleton,
  TOKENS,
  fmt,
  toast,
} from '@skillstack/ui';
import { skillApi, userSkillApi, type SkillCardRes, type SkillDetailRes, type UserSkillItemRes } from '@/api/endpoints';
import { installDesktopSkill, scanLocalSkills, uninstallDesktopSkill } from './desktopBridge';
import { HoverTooltipButton } from './HoverTooltipButton';
import { isLocalEnabled } from './status';
import { desktopEdgeScrollAreaStyle, desktopPageFrameStyle, useTransientScrollbar } from './transientScrollbar';

const CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'dev', name: '开发工具' },
  { id: 'data', name: '数据处理' },
  { id: 'design', name: '设计协作' },
  { id: 'doc', name: '文档生成' },
  { id: 'devops', name: '运维' },
  { id: 'ai', name: 'AI 增强' },
];

export default function PlazaPage() {
  const qc = useQueryClient();
  const [installingSkillId, setInstallingSkillId] = useState<number | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillCardRes | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const scrollbar = useTransientScrollbar();
  const skills = useQuery({ queryKey: ['desktop-plaza'], queryFn: () => skillApi.plaza({ page: 1, size: 12 }) });
  const mine = useQuery({ queryKey: ['desktop-user-skills'], queryFn: userSkillApi.mine });
  const cloudItems = useMemo(() => mine.data || [], [mine.data]);
  const locals = useQuery({
    queryKey: ['desktop-local-skills', cloudItems.map((item) => `${item.id}:${item.slug}:${item.source}`).join('|')],
    queryFn: () => scanLocalSkills(cloudItems),
    placeholderData: (previousData) => previousData,
  });
  const subscribeAndInstall = useMutation({
    mutationFn: ({ skillId, cloud }: { skillId: number; cloud?: UserSkillItemRes }) =>
      addOrInstallPlazaSkill(skillId, cloud, {
        subscribe: userSkillApi.subscribe,
        install: installDesktopSkill,
        remove: userSkillApi.remove,
        uninstall: uninstallDesktopSkill,
        invalidate: (queryKey) => qc.invalidateQueries({ queryKey }),
      }),
    onSuccess: () => toast({ kind: 'success', message: '已添加并安装 Skill' }),
    onError: (error) => toast({ kind: 'error', message: errorMessage(error, '安装失败') }),
    onSettled: () => setInstallingSkillId(null),
  });

  const addedBySkillId = new Map(
    cloudItems
      .filter((item) => item.source === 'TEAM' || item.source === 'PUBLIC')
      .map((item) => [item.skillId, item]),
  );
  const addedSkillIds = new Set(addedBySkillId.keys());
  const installedSkillIds = new Set(
    (locals.data || [])
      .filter((item) => item.source === 'TEAM' || item.source === 'PUBLIC')
      .filter(isLocalEnabled)
      .map((item) => item.skillId)
      .filter((skillId): skillId is number => typeof skillId === 'number'),
  );
  const installedSlugs = new Set((locals.data || []).filter(isLocalEnabled).map((item) => item.slug));
  const allItems = skills.data?.items || [];

  useEffect(() => {
    if (skills.isError) {
      toast({ kind: 'error', message: errorMessage(skills.error, '广场 Skill 加载失败') });
    }
  }, [skills.isError, skills.error]);

  useEffect(() => {
    if (mine.isError) {
      toast({ kind: 'error', message: errorMessage(mine.error, '我的 Skills 加载失败') });
    }
  }, [mine.isError, mine.error]);

  useEffect(() => {
    if (locals.isError) {
      toast({ kind: 'error', message: errorMessage(locals.error, '本地安装状态读取失败') });
    }
  }, [locals.isError, locals.error]);

  // Client-side filter: category + search (per convention, server /api/skills ignores cat)
  const catFiltered = cat === 'all' ? allItems : allItems.filter((s) => (s.cat || '') === cat);
  const keyword = q.trim().toLowerCase();
  const items = keyword
    ? catFiltered.filter((s) =>
        [s.name, s.slug, s.shortDesc || s.short || '', s.author?.name || '', ...(s.tags || [])].some(
          (text) => (text || '').toLowerCase().includes(keyword),
        ),
      )
    : catFiltered;

  return (
    <div style={pageStyle}>
      <SectionHeader
        title="Skills 广场"
        hint="发现公开 Skill，添加后会进入我的 Skills，可选择后续安装。"
      />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <SearchInput
          className="desktop-skill-search-input"
          width={360}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="按名称、描述、标签搜索..."
        />
      </div>

      <div style={chipRowStyle}>
        {CATEGORIES.map((c) => {
          const isActive = cat === c.id;
          return (
            <Pressable
              key={c.id}
              onClick={() => setCat(c.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 28,
                padding: '0 11px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 500,
                lineHeight: 1,
                border: `1px solid ${isActive ? TOKENS.primary : TOKENS.border}`,
                background: isActive ? TOKENS.primarySoft : TOKENS.bg,
                color: isActive ? TOKENS.primary : TOKENS.text2,
              }}
            >
              {c.name}
            </Pressable>
          );
        })}
      </div>

      {skills.isLoading ? (
        <div style={gridStyle}>
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
            <div key={i} style={skeletonCardStyle}>
              <Skeleton height={44} width={44} radius={10} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton height={14} width="60%" />
                <Skeleton height={12} width="40%" />
              </div>
              <Skeleton height={12} width="100%" />
              <Skeleton height={12} width="80%" />
            </div>
          ))}
        </div>
      ) : skills.isError ? (
        <EmptyState title="广场 Skill 加载失败" hint="请刷新重试" compact />
      ) : items.length === 0 ? (
        <EmptyState
          title={keyword || cat !== 'all' ? '没有匹配的 Skill' : '暂无公开 Skill'}
          hint={keyword || cat !== 'all' ? '尝试修改搜索词或分类' : undefined}
        />
      ) : (
        <>
          <div
            ref={scrollbar.scrollAreaRef}
            className="desktop-edge-scroll"
            onScroll={scrollbar.onScroll}
            style={{ ...desktopEdgeScrollAreaStyle, ...gridStyle }}
          >
            {items.map((skill) => (
              <PlazaSkillCard
                key={skill.id || skill.slug}
                skill={skill}
                added={isPlazaSkillAdded(skill, addedSkillIds)}
                installed={isPlazaSkillInstalled(skill, installedSkillIds, installedSlugs)}
                adding={Boolean(skill.id && installingSkillId === Number(skill.id) && subscribeAndInstall.isPending)}
                onAdd={() => {
                  if (!skill.id) return;
                  const skillId = Number(skill.id);
                  setInstallingSkillId(skillId);
                  subscribeAndInstall.mutate({ skillId, cloud: addedBySkillId.get(skillId) });
                }}
                onOpen={() => setSelectedSkill(skill)}
              />
            ))}
          </div>
          <div className="desktop-edge-scroll-thumb" style={scrollbar.thumbStyle} />
        </>
      )}

      {selectedSkill && (
        <PlazaSkillDetailDialog
          skill={selectedSkill}
          added={isPlazaSkillAdded(selectedSkill, addedSkillIds)}
          installed={isPlazaSkillInstalled(selectedSkill, installedSkillIds, installedSlugs)}
          adding={Boolean(selectedSkill.id && installingSkillId === Number(selectedSkill.id) && subscribeAndInstall.isPending)}
          onClose={() => setSelectedSkill(null)}
          onAdd={() => {
            if (!selectedSkill.id) return;
            const skillId = Number(selectedSkill.id);
            setInstallingSkillId(skillId);
            subscribeAndInstall.mutate({ skillId, cloud: addedBySkillId.get(skillId) });
          }}
        />
      )}
    </div>
  );
}

function toSkillCardData(skill: SkillCardRes): SkillCardData {
  return {
    icon: (skill.icon || skill.name || 'S').slice(0, 1).toUpperCase(),
    seed: skill.slug || skill.name,
    cat: skill.cat || '',
    iconUrl: skill.iconUrl ?? undefined,
    name: skill.name,
    visibility: skill.visibility === 'TEAM_PRIVATE' ? 'TEAM_PRIVATE' : 'PUBLIC',
    version: skill.version || '0.0.0',
    author: { name: skill.author?.name || 'Root Admin' },
    short: skill.shortDesc || skill.short || '',
    tags: skill.tags || [],
    installs: skill.installs ?? 0,
    score: typeof skill.score === 'number' ? skill.score : Number(skill.score ?? 0),
    updated: skill.updated || '',
  };
}

function PlazaSkillCard({
  skill,
  added,
  installed,
  adding,
  onAdd,
  onOpen,
}: {
  skill: SkillCardRes;
  added: boolean;
  installed: boolean;
  adding: boolean;
  onAdd: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      className="desktop-plaza-card"
      role="button"
      tabIndex={0}
      aria-label={`查看 ${skill.name} 详情`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      {added ? (
        <button
          type="button"
          className="desktop-plaza-install-button"
          disabled
          aria-label={`${skill.name} 已添加`}
          title={installed ? '已安装' : '已添加'}
        >
          ✓
        </button>
      ) : (
        <HoverTooltipButton
          type="button"
          className="desktop-plaza-install-button"
          disabled={adding || !skill.id}
          onClick={(event) => {
            event.stopPropagation();
            onAdd();
          }}
          aria-label={`添加 ${skill.name} 到我的 Skills`}
          tooltip="安装"
        >
          +
        </HoverTooltipButton>
      )}
      <SkillCard skill={toSkillCardData(skill)} />
    </div>
  );
}

export function PlazaSkillDetailDialog({
  skill,
  added = false,
  installed,
  statusLabel,
  adding,
  onAdd,
  onClose,
}: {
  skill: SkillCardRes;
  added?: boolean;
  installed: boolean;
  statusLabel?: string;
  adding: boolean;
  onAdd: () => void;
  onClose: () => void;
}) {
  const detailQuery = useQuery({
    queryKey: ['desktop-skill-detail', skill.slug],
    queryFn: () => skillApi.detail(skill.slug),
    enabled: Boolean(skill.slug),
  });
  const detail = mergeSkillDetail(skill, detailQuery.data);
  const version = detail.version || '0.0.0';
  const mdQuery = useQuery({
    queryKey: ['desktop-skill-md', skill.slug, version],
    queryFn: () => skillApi.skillMd(skill.slug, version),
    enabled: Boolean(skill.slug) && Boolean(version),
  });
  const content = mdQuery.data?.content?.trim() || detail.descriptionMd?.trim() || detail.shortDesc || detail.short || '暂无技能内容。';
  const actionLabel = statusLabel || (installed ? '已安装' : added ? '已添加' : adding ? '安装中...' : '添加并安装');
  const actionDisabled = Boolean(statusLabel) || installed || added || adding || !skill.id;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="desktop-skill-dialog-backdrop" onClick={onClose}>
      <div
        className="desktop-skill-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="desktop-skill-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="desktop-skill-dialog-close"
          aria-label="关闭技能详情"
          onClick={onClose}
        >
          <I.x size={20} />
        </button>

        <div className="desktop-skill-dialog-header">
          <SkillIcon
            ch={(detail.icon || detail.name || 'S').slice(0, 1).toUpperCase()}
            seed={detail.slug || detail.name}
            cat={detail.cat || ''}
            url={detail.iconUrl ?? undefined}
            size={64}
          />
          <div className="desktop-skill-dialog-title-block">
            <div className="desktop-skill-dialog-title-row">
              <h2 id="desktop-skill-dialog-title">{detail.name}</h2>
              <span>Skill</span>
            </div>
            <p>{detail.shortDesc || detail.short || '暂无简介。'}</p>
            <div className="desktop-skill-dialog-meta">
              <span>v{version}</span>
              <span>{detail.author?.name || 'Root Admin'}</span>
              <span>{detail.catName || detail.cat || '未分类'}</span>
              <span>{detail.updated || '未更新'}</span>
            </div>
          </div>
        </div>

        <div className="desktop-skill-dialog-stats" aria-label="技能数据">
          <DialogStat icon={<I.download size={14} />} label="安装" value={fmt(detail.installs ?? 0)} />
          <DialogStat icon={<I.starFill size={14} style={{ color: '#F59E0B' }} />} label="评分" value={formatScore(detail.score)} />
          <DialogStat icon={<I.layers size={14} />} label="文件" value={String(detail.filesCount ?? '—')} />
          <DialogStat icon={<I.shield size={14} />} label="安全" value={formatSafety(detail.safety)} />
        </div>

        <div className="desktop-skill-dialog-tags">
          {(detail.tags || []).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
          {(!detail.tags || detail.tags.length === 0) && <span>暂无标签</span>}
        </div>

        <div className="desktop-skill-dialog-content">
          <div className="desktop-skill-dialog-section-title">
            <I.list size={15} />
            技能内容
            {detailQuery.isLoading || mdQuery.isLoading ? <span>加载中...</span> : null}
          </div>
          <pre>{content}</pre>
        </div>

        <div className="desktop-skill-dialog-actions">
          <Button
            type="button"
            variant={installed || added ? 'secondary' : 'dark'}
            disabled={actionDisabled}
            icon={installed || added ? <I.check size={15} /> : <I.plus size={15} />}
            onClick={onAdd}
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function isPlazaSkillAdded(skill: SkillCardRes, addedSkillIds: Set<number>): boolean {
  return Boolean(skill.id && addedSkillIds.has(Number(skill.id)));
}

function DialogStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div>
      <span>{icon}</span>
      <strong>{value}</strong>
      <em>{label}</em>
    </div>
  );
}

function mergeSkillDetail(base: SkillCardRes, detail?: SkillDetailRes): SkillDetailRes {
  return {
    ...base,
    ...detail,
    author: detail?.author || base.author,
    tags: detail?.tags || base.tags || [],
  };
}

function formatScore(score: SkillCardRes['score']): string {
  if (typeof score === 'number') return score ? String(score) : '—';
  if (typeof score === 'string' && score.trim()) return score;
  return '—';
}

function formatSafety(safety: SkillDetailRes['safety']): string {
  if (safety === 'pass') return '通过';
  if (safety === 'warn') return '提示';
  if (safety === 'fail') return '风险';
  return '—';
}

export async function subscribeAndInstallPlazaSkill(
  skillId: number,
  deps: PlazaInstallDeps,
) {
  const cloud = await deps.subscribe(skillId);
  await deps.invalidate(['desktop-user-skills']);
  await installCloudSkillWithRollback(cloud, deps);
}

export async function addOrInstallPlazaSkill(
  skillId: number,
  existingCloud: UserSkillItemRes | undefined,
  deps: PlazaInstallDeps,
) {
  if (existingCloud) {
    await installCloudSkillWithRollback(existingCloud, deps);
    return;
  }

  await subscribeAndInstallPlazaSkill(skillId, deps);
}

interface PlazaInstallDeps {
  subscribe: (skillId: number) => Promise<UserSkillItemRes>;
  install: (cloud: UserSkillItemRes) => Promise<void>;
  remove: (userSkillId: number) => Promise<unknown>;
  uninstall: (slug: string, userSkillId?: number) => Promise<unknown>;
  invalidate: (queryKey: string[]) => Promise<unknown>;
}

async function installCloudSkillWithRollback(cloud: UserSkillItemRes, deps: PlazaInstallDeps) {
  try {
    await deps.install(cloud);
    await deps.invalidate(['desktop-local-skills']);
  } catch (error) {
    await deps.uninstall(cloud.slug, cloud.id).catch(() => undefined);
    await deps.remove(cloud.id);
    await deps.invalidate(['desktop-user-skills']);
    await deps.invalidate(['desktop-local-skills']);
    throw error;
  }
}

function isPlazaSkillInstalled(
  skill: SkillCardRes,
  installedSkillIds: Set<number>,
  installedSlugs: Set<string>,
): boolean {
  return Boolean(
    (skill.id && installedSkillIds.has(Number(skill.id)))
    || installedSlugs.has(skill.slug),
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message || fallback : fallback;
}

const pageStyle: React.CSSProperties = {
  ...desktopPageFrameStyle,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: 14,
};

const chipRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginBottom: 14,
};

const skeletonCardStyle: React.CSSProperties = {
  background: TOKENS.bg,
  border: `1px solid ${TOKENS.border}`,
  borderRadius: 12,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};
