import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Pressable,
  SearchInput,
  SectionHeader,
  SkillIcon,
  Skeleton,
  TOKENS,
  ConfirmDialog,
  toast,
} from '@skillstack/ui';
import { authApi, skillApi, userSkillApi, type SkillCardRes } from '@/api/endpoints';
import { installDesktopSkill, scanLocalSkills, setDesktopSkillEnabled, uninstallDesktopSkill } from './desktopBridge';
import { HoverTooltipButton } from './HoverTooltipButton';
import { buildPersonalSkillImportReq } from './importPersonalSkill';
import {
  selectFilteredTeamSkillGroups,
  selectMySkillsFilterCounts,
  selectPersonalSkillViews,
  subscribeAndInstallTeamSkill,
} from './mySkillsGroups';
import { buildTeamRecommendationParams } from './recommendations';
import { buildDesktopSkillViews, isLocalEnabled } from './status';
import { desktopEdgeScrollAreaStyle, desktopPageFrameStyle, useTransientScrollbar } from './transientScrollbar';
import { PlazaSkillDetailDialog } from './PlazaPage';
import type { DesktopSkillView } from './types';

type FilterKey = 'all' | 'enabled' | 'updates';

interface TeamRef {
  id: number;
  name: string;
}

interface TeamSkillGroup {
  team: TeamRef;
  items: SkillCardRes[];
}

interface InstallSkillOptions {
  notify: boolean;
  refresh: boolean;
}

interface InstallAllNotifier {
  success: (message: string) => void;
  error: (message: string) => void;
}

export default function MySkillsPage() {
  const qc = useQueryClient();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [pickingImportFile, setPickingImportFile] = useState(false);
  const [installingTeamSkillId, setInstallingTeamSkillId] = useState<number | null>(null);
  const [selectedView, setSelectedView] = useState<DesktopSkillView | null>(null);
  const [selectedTeamSkill, setSelectedTeamSkill] = useState<SkillCardRes | null>(null);
  const [deleteConfirmView, setDeleteConfirmView] = useState<DesktopSkillView | null>(null);
  const scrollbar = useTransientScrollbar();
  const me = useQuery({ queryKey: ['desktop-me'], queryFn: authApi.me });
  const recommendParams = buildTeamRecommendationParams();
  const teams = getSessionTeams(me.data);
  const recommendations = useQuery({
    queryKey: ['desktop-my-skills-team-library', teams.map((team) => team.id).join(','), recommendParams],
    queryFn: async () => {
      const groups: TeamSkillGroup[] = [];
      for (const team of teams) {
        const page = await skillApi.teamSkills(team.id, recommendParams);
        groups.push({ team, items: page.items || [] });
      }
      return groups;
    },
    enabled: teams.length > 0,
  });
  const mine = useQuery({ queryKey: ['desktop-user-skills'], queryFn: userSkillApi.mine });
  const subscribeAndInstallTeam = useMutation({
    mutationFn: (skillId: number) =>
      subscribeAndInstallTeamSkill(skillId, {
        subscribe: userSkillApi.subscribe,
        install: installDesktopSkill,
        remove: userSkillApi.remove,
        uninstall: uninstallDesktopSkill,
        invalidate: (queryKey) => qc.invalidateQueries({ queryKey }),
      }),
    onSuccess: () => toastSuccess('已添加并安装团队 Skill'),
    onError: (error) => toastError(error, '安装失败'),
    onSettled: () => setInstallingTeamSkillId(null),
  });
  const cloudItems = useMemo(() => mine.data || [], [mine.data]);
  const locals = useQuery({
    queryKey: ['desktop-local-skills', cloudItems.map((item) => `${item.id}:${item.slug}:${item.source}`).join('|')],
    queryFn: () => scanLocalSkills(cloudItems),
  });
  const views = useMemo(() => buildDesktopSkillViews(cloudItems, locals.data || []), [cloudItems, locals.data]);

  const removeCloud = useMutation({
    mutationFn: userSkillApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['desktop-user-skills'] }),
  });

  const searchText = search.trim().toLowerCase();
  const filtered = views.filter((view) => {
    if (filter === 'enabled') return isViewEnabled(view);
    if (filter === 'updates') return view.actions.includes('update');
    return true;
  }).filter((view) => matchesMySkillSearch(view, searchText));

  const personal = selectPersonalSkillViews(filtered);
  const teamGroups = recommendations.data || [];
  const filterCounts = selectMySkillsFilterCounts(views, teamGroups);
  const subscribedBySkillId = new Map(
    views
      .filter((view) => {
        const source = view.cloud?.source;
        return (source === 'TEAM' || source === 'PUBLIC') && Number.isFinite(view.cloud?.skillId);
      })
      .map((view) => [view.cloud!.skillId, view]),
  );
  const filteredTeamGroups = filterTeamSkillGroupsBySearch(
    selectFilteredTeamSkillGroups(filter, teamGroups, subscribedBySkillId),
    searchText,
  );

  useEffect(() => {
    if (me.isError) {
      toastError(me.error, '账号信息读取失败');
    }
  }, [me.isError, me.error]);

  useEffect(() => {
    if (mine.isError) {
      toastError(mine.error, '我的 Skills 加载失败');
    }
  }, [mine.isError, mine.error]);

  useEffect(() => {
    if (locals.isError) {
      toastError(locals.error, '本地安装状态读取失败');
    }
  }, [locals.isError, locals.error]);

  useEffect(() => {
    if (recommendations.isError) {
      toastError(recommendations.error, '团队 Skill 加载失败');
    }
  }, [recommendations.isError, recommendations.error]);

  async function refreshLocalSkills() {
    await locals.refetch();
  }

  async function install(view: DesktopSkillView, options: InstallSkillOptions = { notify: true, refresh: true }): Promise<boolean> {
    const cloud = view.cloud;
    if (!cloud) return false;

    try {
      await installDesktopSkill(cloud);
      if (options.refresh) {
        await refreshLocalSkills();
      }
      if (options.notify) {
        toastSuccess(`已安装 ${getSkillLabel(view)}`);
      }
      return true;
    } catch (error) {
      if (options.notify) {
        toastError(error, '安装失败');
      }
      return false;
    }
  }

  async function deleteSkill(view: DesktopSkillView) {
    const cloud = view.cloud;
    const slug = cloud?.slug || view.local?.slug;
    if (!cloud || !slug) return;

    try {
      if (view.local) {
        await uninstallDesktopSkill(slug, cloud.id);
      }
      await removeCloud.mutateAsync(cloud.id);
      await refreshLocalSkills();
      toastSuccess(`已删除 ${getSkillLabel(view)}`);
    } catch (error) {
      toastError(error, '删除失败');
    }
  }

  function requestDeleteSkill(view: DesktopSkillView) {
    setDeleteConfirmView(view);
  }

  async function confirmDeleteSkill() {
    const view = deleteConfirmView;
    if (!view) return;

    setDeleteConfirmView(null);
    await deleteSkill(view);
  }

  async function setLocalEnabled(view: DesktopSkillView, enabled: boolean) {
    if (enabled && !view.local) {
      await install(view);
      return;
    }

    const id = view.cloud?.id || view.local?.userSkillId;
    const slug = view.cloud?.slug || view.local?.slug;
    if (!slug) return;

    try {
      await setDesktopSkillEnabled(slug, id, enabled);
      await refreshLocalSkills();
      toastSuccess(localEnabledToastMessage(enabled, getSkillLabel(view)));
    } catch (error) {
      if (enabled && isLocalCacheMissingError(error)) {
        await install(view);
        return;
      }
      toastError(error, enabled ? '启用失败' : '关闭失败');
    }
  }

  async function installAll() {
    await installAllSkillViews(views, install, {
      success: toastSuccess,
      error: (message) => toast({ kind: 'error', message }),
    });
    await refreshLocalSkills();
  }

  async function importLocalSkill(file: File | undefined | null) {
    if (!file) return;

    setImporting(true);

    try {
      const upload = file.name.toLowerCase().endsWith('.md')
        ? await skillApi.uploadVersionMd(file)
        : await skillApi.uploadVersionZip(file);
      const parseResult = await skillApi.parseVersionZip(upload.zipUrl);
      if (!parseResult.ok) {
        throw new Error('Skill 解析未通过');
      }

      const req = buildPersonalSkillImportReq(parseResult, file.name);
      const cloud = await userSkillApi.importPersonal(req);

      await installDesktopSkill(cloud);
      await qc.invalidateQueries({ queryKey: ['desktop-user-skills'] });
      await refreshLocalSkills();
      toastSuccess(`已导入并安装 ${cloud.name}`);
    } catch (error) {
      toastError(error, '本地导入失败');
    } finally {
      setImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  }

  async function chooseLocalSkillFile() {
    const desktopApi = window.skillstackDesktop;
    if (!desktopApi?.pickSkillFile) {
      importInputRef.current?.click();
      return;
    }

    setPickingImportFile(true);
    try {
      const result = await desktopApi.pickSkillFile();
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      if (!result.data) {
        toastWarning('未选择 Skill 文件');
        return;
      }

      const picked = result.data;
      const file = new File([picked.data], picked.name);
      await importLocalSkill(file);
    } catch (error) {
      toastError(error, '本地导入失败');
    } finally {
      setPickingImportFile(false);
    }
  }

  return (
    <div style={mySkillsPageFrameStyle}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
        <SectionHeader
          title="我的 Skills"
          hint="管理个人、广场和团队 Skills，团队内容按团队名称分组展示"
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexShrink: 0 }}>
          <input
            ref={importInputRef}
            type="file"
            accept=".zip,.md,application/zip,application/x-zip-compressed,text/markdown,text/plain"
            style={{ display: 'none' }}
            onChange={(event) => void importLocalSkill(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={importing || pickingImportFile}
            onClick={() => void chooseLocalSkillFile()}
            style={{ borderRadius: 999 }}
          >
            {pickingImportFile ? '选择中...' : importing ? '导入中...' : '本地导入'}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={importing}
            onClick={() => void installAll()}
            style={{ borderRadius: 999 }}
          >
            一键更新/安装
          </Button>
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, fontSize: 13, flexWrap: 'wrap' }}>
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
          全部 {filterCounts.all}
        </FilterPill>
        <FilterPill active={filter === 'enabled'} onClick={() => setFilter('enabled')}>
          已启用 {filterCounts.enabled}
        </FilterPill>
        <FilterPill active={filter === 'updates'} onClick={() => setFilter('updates')}>
          可更新 {filterCounts.updates}
        </FilterPill>
      </div>

      {/* Search row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <SearchInput
          className="desktop-skill-search-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="按名称、描述、标签搜索..."
          width={360}
        />
      </div>

      {/* Content area */}
      {mine.isLoading || locals.isLoading ? (
        <div style={{ display: 'grid', gap: 9 }}>
          {[1, 2, 3].map((n) => (
            <Card key={n} pad={13} style={{ borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Skeleton height={16} width="40%" style={{ marginBottom: 6 }} />
                  <Skeleton height={12} width="70%" />
                </div>
                <Skeleton width={60} height={28} radius={8} />
              </div>
            </Card>
          ))}
        </div>
      ) : mine.isError ? (
        <EmptyState title="我的 Skills 加载失败" hint="请刷新重试" compact />
      ) : (
        <>
          <div
            ref={scrollbar.scrollAreaRef}
            className="desktop-edge-scroll"
            onScroll={scrollbar.onScroll}
            style={mySkillsScrollAreaStyle}
          >
            <Group
              title="个人"
              items={personal}
              onInstall={install}
              onDelete={requestDeleteSkill}
              onToggleLocal={setLocalEnabled}
              onOpen={setSelectedView}
            />
            <TeamLibrarySection
              groups={filteredTeamGroups}
              isLoading={recommendations.isLoading}
              isError={recommendations.isError}
              subscribedBySkillId={subscribedBySkillId}
              installingSkillId={installingTeamSkillId}
              adding={subscribeAndInstallTeam.isPending}
              onAdd={(skillId) => {
                setInstallingTeamSkillId(skillId);
                subscribeAndInstallTeam.mutate(skillId);
              }}
              onOpen={(skill) => {
                const skillId = Number(skill.id);
                const view = Number.isFinite(skillId) ? subscribedBySkillId.get(skillId) ?? null : null;
                if (view) setSelectedView(view);
                else setSelectedTeamSkill(skill);
              }}
              onInstall={install}
              onToggleLocal={setLocalEnabled}
              onDelete={requestDeleteSkill}
            />
          </div>
          <div className="desktop-edge-scroll-thumb" style={scrollbar.thumbStyle} />
        </>
      )}
      {selectedView && (
        <PlazaSkillDetailDialog
          skill={toDialogSkill(selectedView.cloud ?? selectedView.local!)}
          added={Boolean(selectedView.cloud)}
          installed={isViewEnabled(selectedView)}
          statusLabel={isViewEnabled(selectedView) ? '已安装' : '已禁用'}
          adding={false}
          onClose={() => setSelectedView(null)}
          onAdd={() => void setLocalEnabled(selectedView, true)}
        />
      )}
      {selectedTeamSkill && (
        <PlazaSkillDetailDialog
          skill={selectedTeamSkill}
          installed={false}
          adding={Boolean(selectedTeamSkill.id && installingTeamSkillId === Number(selectedTeamSkill.id) && subscribeAndInstallTeam.isPending)}
          onClose={() => setSelectedTeamSkill(null)}
          onAdd={() => {
            if (!selectedTeamSkill.id) return;
            const skillId = Number(selectedTeamSkill.id);
            setInstallingTeamSkillId(skillId);
            subscribeAndInstallTeam.mutate(skillId);
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleteConfirmView)}
        danger
        title="删除 Skill"
        description={deleteConfirmView ? `确认删除「${getSkillLabel(deleteConfirmView)}」？将卸载本地插件，并删除我的 Skills 记录。` : ''}
        confirmLabel="删除"
        confirmAriaLabel="确认删除 Skill"
        onCancel={() => setDeleteConfirmView(null)}
        onConfirm={() => void confirmDeleteSkill()}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter pill
// ---------------------------------------------------------------------------

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      onClick={onClick}
      style={{
        padding: '7px 10px',
        border: `1px solid ${active ? TOKENS.primary : TOKENS.border}`,
        borderRadius: 999,
        background: active ? TOKENS.primarySoft : TOKENS.bg,
        color: active ? TOKENS.primary : TOKENS.text2,
        fontWeight: active ? 700 : 600,
        fontSize: 13,
      }}
    >
      {children}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Personal group
// ---------------------------------------------------------------------------

function AssetSectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div style={assetSectionHeaderStyle}>
      <span style={assetSectionTitleStyle}>{title}</span>
      <Badge tone="neutral" size="sm">{count}</Badge>
    </div>
  );
}

function Group(props: {
  title: string;
  items: DesktopSkillView[];
  onInstall: (view: DesktopSkillView) => void;
  onDelete: (view: DesktopSkillView) => void;
  onToggleLocal: (view: DesktopSkillView, enabled: boolean) => void;
  onOpen: (view: DesktopSkillView) => void;
}) {
  return (
    <section style={assetSectionStyle}>
      <AssetSectionHeader title={props.title} count={props.items.length} />
      {props.items.length === 0 ? (
        <EmptyState title="暂无 Skill" compact />
      ) : (
        <div style={twoColumnSkillGridStyle}>
          {props.items.map((view) => (
            <SkillRow
              key={`${view.cloud?.id || 'local'}-${view.local?.slug || view.cloud?.slug || 'cloud'}`}
              view={view}
              onInstall={props.onInstall}
              onDelete={props.onDelete}
              onToggleLocal={props.onToggleLocal}
              onOpen={props.onOpen}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Team library section
// ---------------------------------------------------------------------------

function TeamLibrarySection({
  groups,
  isLoading,
  isError,
  subscribedBySkillId,
  installingSkillId,
  adding,
  onAdd,
  onOpen,
  onInstall,
  onToggleLocal,
  onDelete,
}: {
  groups: TeamSkillGroup[];
  isLoading: boolean;
  isError: boolean;
  subscribedBySkillId: Map<number, DesktopSkillView>;
  installingSkillId: number | null;
  adding: boolean;
  onAdd: (skillId: number) => void;
  onOpen: (skill: SkillCardRes) => void;
  onInstall: (view: DesktopSkillView) => void;
  onToggleLocal: (view: DesktopSkillView, enabled: boolean) => void;
  onDelete: (view: DesktopSkillView) => void;
}) {
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  if (isLoading) {
    return (
      <section style={assetSectionStyle}>
        <AssetSectionHeader title="团队" count={total} />
        <div style={twoColumnSkillGridStyle}>
          {[1, 2, 3].map((n) => (
            <Card key={n} pad={13} style={{ borderRadius: 8, display: 'grid', gap: 8 }}>
              <Skeleton height={12} width="50%" />
              <Skeleton height={16} width="80%" />
              <Skeleton height={12} width="60%" />
              <Skeleton height={36} />
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section style={assetSectionStyle}>
        <AssetSectionHeader title="团队" count={total} />
        <EmptyState title="团队 Skill 加载失败" hint="请刷新重试" compact />
      </section>
    );
  }

  if (groups.length === 0 || total === 0) {
    return (
      <section style={assetSectionStyle}>
        <AssetSectionHeader title="团队" count={0} />
        <EmptyState title="暂无 Skill" compact />
      </section>
    );
  }

  return (
    <>
      {groups.map((group) => (
        <section key={group.team.id} style={assetSectionStyle}>
          <AssetSectionHeader title={group.team.name} count={group.items.length} />
          <div style={twoColumnSkillGridStyle}>
            {group.items.map((skill) => {
              const skillId = Number(skill.id);
              const view = Number.isFinite(skillId) ? subscribedBySkillId.get(skillId) ?? null : null;
              return (
                <TeamSkillCard
                  key={`${group.team.id}-${skill.id || skill.slug}`}
                  skill={skill}
                  view={view}
                  adding={adding && installingSkillId === skillId}
                  onAdd={() => Number.isFinite(skillId) && onAdd(skillId)}
                  onOpen={() => onOpen(skill)}
                  onInstall={onInstall}
                  onToggleLocal={onToggleLocal}
                  onDelete={onDelete}
                />
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Team skill card
// ---------------------------------------------------------------------------

function TeamSkillCard({
  skill,
  view,
  adding,
  onAdd,
  onOpen,
  onInstall,
  onToggleLocal,
  onDelete,
}: {
  skill: SkillCardRes;
  view: DesktopSkillView | null;
  adding: boolean;
  onAdd: () => void;
  onOpen: () => void;
  onInstall: (view: DesktopSkillView) => void;
  onToggleLocal: (view: DesktopSkillView, enabled: boolean) => void;
  onDelete: (view: DesktopSkillView) => void;
}) {
  const enabled = isViewEnabled(view);
  const statusLabel = mySkillCardStatusLabel(view?.statusLabel);
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
      style={{ outline: 'none' }}
    >
      <Card pad={13} style={skillTileCardStyle}>
        <div style={skillTileTopStyle}>
          <SkillIcon
            ch={(skill.icon || skill.name || 'S').slice(0, 1).toUpperCase()}
            seed={skill.slug || skill.name}
            cat={skill.cat || ''}
            url={skill.iconUrl ?? undefined}
            size={46}
          />
          <div style={skillTileTextStyle}>
            <div style={skillTileTitleRowStyle}>
              <span style={skillTileTitleStyle}>{skill.name}</span>
              <Badge tone="primary" size="sm">团队</Badge>
              {statusLabel && (
                <Badge tone={statusTone(statusLabel)} size="sm">
                  {statusLabel}
                </Badge>
              )}
            </div>
            <div style={skillTileMetaStyle}>
              v{skill.version || '0.0.0'} · {skill.author?.name || '团队成员'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {!view ? (
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
            ) : (
              <>
                {view.actions.includes('update') && (
                  <IconButton
                    label={`更新 ${skill.name}`}
                    icon={<RefreshCw size={15} />}
                    size="sm"
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      onInstall(view);
                    }}
                    style={{ color: TOKENS.warning }}
                  />
                )}
                <span className="desktop-skill-delete-action">
                  <IconButton
                    label="删除"
                    icon={<Trash2 size={15} />}
                    size="sm"
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(view);
                    }}
                    style={{ color: TOKENS.text3 }}
                  />
                </span>
                <ToggleSwitch
                  checked={enabled}
                  label={enabled ? '禁用' : '启用'}
                  onChange={(next) => onToggleLocal(view, next)}
                />
              </>
            )}
          </div>
        </div>
        <div style={skillTileSummaryStyle}>
          {skill.shortDesc || skill.short || ''}
        </div>
      </Card>
    </div>
  );
}

function ToggleSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <HoverTooltipButton
      type="button"
      className="desktop-skill-toggle"
      tooltip={label}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      style={{
        width: 42,
        height: 24,
        borderRadius: 999,
        border: 'none',
        padding: 2,
        background: checked ? '#20B26B' : TOKENS.border,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        transition: 'background 120ms ease',
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.14)',
        }}
      />
    </HoverTooltipButton>
  );
}
// ---------------------------------------------------------------------------
// Skill row
// ---------------------------------------------------------------------------

function SkillRow(props: {
  view: DesktopSkillView;
  onInstall: (view: DesktopSkillView) => void;
  onDelete: (view: DesktopSkillView) => void;
  onToggleLocal: (view: DesktopSkillView, enabled: boolean) => void;
  onOpen: (view: DesktopSkillView) => void;
}) {
  const view = props.view;
  const label = getSkillLabel(view);
  const muted = view.statusLabel === '仅本地';
  const enabled = isViewEnabled(view);
  const statusLabel = mySkillCardStatusLabel(view.statusLabel);

  return (
    <div
      className="desktop-plaza-card"
      role="button"
      tabIndex={0}
      aria-label={`查看 ${label} 详情`}
      onClick={() => props.onOpen(view)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          props.onOpen(view);
        }
      }}
      style={{ outline: 'none' }}
    >
      <Card
        pad={13}
        style={{
          ...skillTileCardStyle,
          background: muted ? TOKENS.bgAlt : TOKENS.bg,
        }}
      >
        <div style={skillTileTopStyle}>
          <SkillIcon
            ch={(view.cloud?.icon || label || 'S').slice(0, 1).toUpperCase()}
            seed={view.cloud?.slug || view.local?.slug || label}
            cat={view.cloud?.catCode || ''}
            url={undefined}
            size={46}
          />
          <div style={skillTileTextStyle}>
            <div style={skillTileTitleRowStyle}>
              <span style={{ ...skillTileTitleStyle, color: muted ? TOKENS.text2 : TOKENS.text }}>
                {label}
              </span>
              <Badge tone={sourceTone(view)} size="sm">
                {sourceLabel(view)}
              </Badge>
              {statusLabel && (
                <Badge tone={statusTone(statusLabel)} size="sm">
                  {statusLabel}
                </Badge>
              )}
            </div>
            <div style={skillTileMetaStyle}>
              {skillMetaText(view)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
            {view.actions.includes('update') && (
              <IconButton
                label={`更新 ${label}`}
                icon={<RefreshCw size={16} />}
                size="sm"
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onInstall(view);
                }}
                style={{ color: TOKENS.warning }}
              />
            )}
            {view.cloud && (
              <span className="desktop-skill-delete-action">
                <IconButton
                  label="删除"
                  icon={<Trash2 size={16} />}
                  size="sm"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onDelete(view);
                  }}
                  style={{ color: TOKENS.text3 }}
                />
              </span>
            )}
            <ToggleSwitch
              checked={enabled}
              label={enabled ? '禁用' : '启用'}
              onChange={(next) => props.onToggleLocal(view, next)}
            />
          </div>
        </div>
        <div style={skillTileSummaryStyle}>
          {skillSummary(view)}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mySkillsPageFrameStyle: React.CSSProperties = {
  ...desktopPageFrameStyle,
  minWidth: 0,
  overflowX: 'hidden',
};

const mySkillsScrollAreaStyle: React.CSSProperties = {
  ...desktopEdgeScrollAreaStyle,
  overflowX: 'hidden',
  display: 'grid',
  alignContent: 'start',
  rowGap: 32,
};

const skillTileGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
  gap: 12,
  minWidth: 0,
};

const twoColumnSkillGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(300px, 1fr))',
  gap: 12,
  minWidth: 0,
};

const assetSectionStyle: React.CSSProperties = {
  marginBottom: 0,
};

const assetSectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 14,
};

const assetSectionTitleStyle: React.CSSProperties = {
  color: TOKENS.text,
  fontSize: 16,
  fontWeight: 600,
};

const skillTileCardStyle: React.CSSProperties = {
  borderRadius: 8,
  display: 'grid',
  gap: 10,
  height: '100%',
  minWidth: 0,
  cursor: 'pointer',
};

const skillTileTopStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  minWidth: 0,
};

const skillTileTextStyle: React.CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
};

const skillTileTitleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  minWidth: 0,
  flexWrap: 'wrap',
};

const skillTileTitleStyle: React.CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: TOKENS.text,
  fontSize: 15,
  fontWeight: 800,
};

const skillTileMetaStyle: React.CSSProperties = {
  color: TOKENS.text3,
  fontSize: 12,
  marginTop: 4,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const skillTileSummaryStyle: React.CSSProperties = {
  color: TOKENS.text2,
  fontSize: 12.5,
  lineHeight: 1.5,
  minHeight: 19,
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
};

function getSkillLabel(view: DesktopSkillView) {
  return view.cloud?.name || view.local?.name || view.cloud?.slug || view.local?.slug || 'Skill';
}

export function matchesMySkillSearch(view: DesktopSkillView, q: string): boolean {
  const keyword = q.trim().toLowerCase();
  if (!keyword) return true;

  return searchableTexts([
    getSkillLabel(view),
    view.cloud?.slug,
    view.local?.slug,
    view.cloud?.shortDesc,
    skillDisplayAuthor(view),
  ]).some((text) => text.toLowerCase().includes(keyword));
}

export function matchesTeamSkillSearch(skill: SkillCardRes, q: string): boolean {
  const keyword = q.trim().toLowerCase();
  if (!keyword) return true;

  return searchableTexts([
    skill.name,
    skill.slug,
    skill.shortDesc || skill.short,
    skill.author?.name || skill.author?.handle,
    ...(skill.tags || []),
  ]).some((text) => text.toLowerCase().includes(keyword));
}

function filterTeamSkillGroupsBySearch(groups: TeamSkillGroup[], q: string): TeamSkillGroup[] {
  const keyword = q.trim().toLowerCase();
  if (!keyword) return groups;

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((skill) => matchesTeamSkillSearch(skill, keyword)),
    }))
    .filter((group) => group.items.length > 0);
}

function searchableTexts(values: Array<string | null | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value));
}

export function localEnabledToastMessage(enabled: boolean, label: string): string {
  return `${enabled ? '已启用' : '已禁用'} ${label}`;
}

export function mySkillCardStatusLabel(label: string | null | undefined): string | null {
  if (label === '可更新' || label === '仅本地') return label;
  return null;
}

export async function installAllSkillViews(
  views: DesktopSkillView[],
  installView: (view: DesktopSkillView, options: InstallSkillOptions) => Promise<boolean>,
  notify: InstallAllNotifier,
): Promise<void> {
  const targets = views.filter((view) => view.actions.includes('install') || view.actions.includes('update'));
  if (targets.length === 0) {
    notify.success('所有 Skills 已是最新版本');
    return;
  }

  let failedCount = 0;
  for (const view of targets) {
    const ok = await installView(view, { notify: false, refresh: false });
    if (!ok) {
      failedCount += 1;
    }
  }

  if (failedCount === 0) {
    notify.success('所有 Skills 已是最新版本');
    return;
  }

  notify.error(`${failedCount} 个 Skill 安装或更新失败`);
}

function isViewEnabled(view: DesktopSkillView | null | undefined): boolean {
  return isLocalEnabled(view?.local);
}

function isLocalCacheMissingError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Local skill cache is missing');
}

function skillSummary(view: DesktopSkillView) {
  return view.cloud?.shortDesc || view.local?.slug || view.cloud?.slug || '';
}

function skillDisplayVersion(view: DesktopSkillView) {
  const cloud = view.cloud;
  if (cloud?.source === 'TEAM' || cloud?.source === 'PUBLIC') {
    return cloud.publicVersion || cloud.version || view.local?.version || '0.0.0';
  }
  return cloud?.version || view.local?.version || '0.0.0';
}

function skillDisplayAuthor(view: DesktopSkillView) {
  const author = view.cloud?.author;
  const name = author?.name || author?.handle;
  if (name) return name;
  if (view.cloud?.source === 'PERSONAL' || view.local?.source === 'PERSONAL') return '个人';
  return '团队成员';
}

function skillMetaText(view: DesktopSkillView) {
  return [
    `v${skillDisplayVersion(view)}`,
    skillDisplayAuthor(view),
  ].filter(Boolean).join(' · ');
}

function skillDisplayDate(view: DesktopSkillView) {
  if (view.cloud) return itemDisplayDate(view.cloud);
  if (view.local) return itemDisplayDate(view.local);
  return '';
}

function itemDisplayVersion(item: NonNullable<DesktopSkillView['cloud']> | NonNullable<DesktopSkillView['local']>) {
  if ('publicVersion' in item && (item.source === 'TEAM' || item.source === 'PUBLIC')) {
    return item.publicVersion || item.version || '0.0.0';
  }
  return item.version || '0.0.0';
}

function itemDisplayAuthor(item: NonNullable<DesktopSkillView['cloud']> | NonNullable<DesktopSkillView['local']>) {
  if ('author' in item) {
    const name = item.author?.name || item.author?.handle;
    if (name) return name;
  }
  if (item.source === 'PERSONAL') return '个人';
  return '团队成员';
}

function itemDisplayDate(item: NonNullable<DesktopSkillView['cloud']> | NonNullable<DesktopSkillView['local']>) {
  const value = 'zipUrl' in item
    ? item.updatedAt || item.createdAt
    : item.updatedAt || item.installedAt;
  return formatDateText(value);
}

function formatDateText(value: string | null | undefined) {
  if (!value) return '';
  return value.slice(0, 10);
}

function sourceLabel(view: DesktopSkillView) {
  const source = view.cloud?.source || view.local?.source;
  if (source === 'TEAM') return '团队';
  if (source === 'PUBLIC') return '广场';
  return '个人';
}

function sourceTone(view: DesktopSkillView) {
  const source = view.cloud?.source || view.local?.source;
  if (source === 'TEAM') return 'primary' as const;
  if (source === 'PUBLIC') return 'info' as const;
  return 'neutral' as const;
}

export function toDialogSkill(item: NonNullable<DesktopSkillView['cloud']> | NonNullable<DesktopSkillView['local']>): SkillCardRes {
  return {
    id: 'id' in item ? item.id : item.skillId,
    slug: item.slug,
    name: item.name,
    shortDesc: 'shortDesc' in item ? item.shortDesc : undefined,
    version: itemDisplayVersion(item),
    icon: 'icon' in item ? item.icon : undefined,
    cat: 'catCode' in item ? item.catCode : undefined,
    author: 'author' in item && item.author ? item.author : { name: itemDisplayAuthor(item) },
    updated: itemDisplayDate(item),
  };
}

function getSessionTeams(session: unknown): TeamRef[] {
  const rawTeams = (session as { myTeams?: Array<{ id?: number | string | null; name?: string | null; slug?: string | null }> } | null)
    ?.myTeams || [];
  const teams: TeamRef[] = [];
  for (const item of rawTeams) {
    const id = Number(item.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    teams.push({
      id,
      name: item.name || item.slug || `Team ${id}`,
    });
  }
  return teams;
}

function statusTone(label: string) {
  if (label === '最新') return 'success' as const;
  if (label === '可更新') return 'warning' as const;
  if (label === '已禁用') return 'info' as const;
  return 'neutral' as const;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message || fallback : fallback;
}

function toastError(error: unknown, fallback: string) {
  toast({ kind: 'error', message: errorMessage(error, fallback) });
}

function toastSuccess(message: string) {
  toast({ kind: 'success', message });
}

function toastWarning(message: string) {
  toast({ kind: 'warning', message });
}
