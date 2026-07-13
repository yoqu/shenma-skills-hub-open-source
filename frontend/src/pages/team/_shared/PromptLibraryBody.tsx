import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { TOKENS } from '@/lib/tokens';
import { Button, Card, EmptyState, Input, PromptCard, toast } from '@/components/ui';
import { Tabs, type TabItem } from '@/components/chrome';
import { I } from '@/components/icons';
import { useCurrentTeam, useTeamPrompts } from '@/api/data';
import { promptApi } from '@/api/endpoints';
import type { PromptCard as PromptCardData } from '@/api/data';

type PromptTab = 'all' | 'APPROVED' | 'UNLISTED';
type VisibilityTab = 'all' | 'PUBLIC' | 'TEAM_PRIVATE';

export function PromptLibraryBody({ writer }: { writer: boolean }) {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const { teamId, teamSlug } = useCurrentTeam();
  const [status, setStatus] = useState<PromptTab>('all');
  const [visibility, setVisibility] = useState<VisibilityTab>('all');
  const [q, setQ] = useState('');
  const promptsQuery = useTeamPrompts({
    status: status === 'all' ? undefined : status,
    visibility: visibility === 'all' ? undefined : visibility,
    q: q || undefined,
    size: 80,
  });
  const prompts = promptsQuery.data ?? [];

  const tabs: TabItem[] = useMemo(
    () => [
      { id: 'all', label: '全部', count: prompts.length },
      { id: 'APPROVED', label: '已发布', count: prompts.filter((p) => p.status === 'APPROVED').length },
      { id: 'UNLISTED', label: '已下架', count: prompts.filter((p) => p.status === 'UNLISTED').length },
    ],
    [prompts],
  );

  return (
    <>
      <div
        style={{
          background: '#fff',
          borderBottom: `1px solid ${TOKENS.border}`,
          padding: '0 32px',
        }}
      >
        <Tabs tabs={tabs} active={status} onChange={(id) => setStatus(id as PromptTab)} />
      </div>
      <div
        style={{
          padding: '18px 32px',
          background: '#fff',
          borderBottom: `1px solid ${TOKENS.borderSoft}`,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 240, maxWidth: 420, position: 'relative' }}>
          <I.search size={14} style={{ position: 'absolute', left: 11, top: 9, color: TOKENS.text3 }} />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索 Prompt 名称、slug、描述、标签…"
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
        <Segment
          value={visibility}
          onChange={setVisibility}
          options={[
            ['all', '全部可见性'],
            ['PUBLIC', '公开'],
            ['TEAM_PRIVATE', '团队私有'],
          ]}
        />
        <span style={{ marginLeft: 'auto', fontSize: 12, color: TOKENS.text3 }}>
          {prompts.length} 项
        </span>
      </div>

      <div style={{ padding: '18px 32px 36px', overflow: 'auto' }}>
        {promptsQuery.isError ? (
          <Card pad={24}>
            <EmptyState
              icon={<I.x size={20} />}
              title="Prompt 列表加载失败"
              hint={promptsQuery.error instanceof Error ? promptsQuery.error.message : '请稍后重试'}
              action={
                <Button variant="secondary" size="sm" onClick={() => promptsQuery.refetch()}>
                  重试
                </Button>
              }
            />
          </Card>
        ) : promptsQuery.isLoading ? (
          <Card pad={24}>
            <EmptyState icon={<I.clock size={20} />} title="正在加载 Prompt 库…" />
          </Card>
        ) : prompts.length === 0 ? (
          <Card pad={24}>
            <EmptyState
              icon={<I.code size={20} />}
              title={q ? '没有匹配的 Prompt' : '团队还没有 Prompt'}
              hint={q ? '换个关键词试试，或者清空搜索' : '把常用上下文和角色设定沉淀成可复用 Prompt'}
              action={
                writer ? (
                  <Button variant="primary" size="sm" onClick={() => nav('/create/prompt')}>
                    新建 Prompt
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 14,
            }}
          >
            {prompts.map((p) => (
              <div key={`${p.teamSlug ?? 'team'}-${p.slug}`} style={{ position: 'relative' }}>
                <PromptCard
                  prompt={p}
                  onClick={() => nav(promptHref(p, teamSlug))}
                />
                <PromptActions
                  prompt={p}
                  writer={writer}
                  teamId={teamId ? Number(teamId) : undefined}
                  onOpen={() => nav(promptHref(p, teamSlug))}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function PromptActions({
  prompt,
  writer,
  teamId,
  onOpen,
}: {
  prompt: PromptCardData;
  writer: boolean;
  teamId?: number;
  onOpen: () => void;
}) {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['team-prompts', teamId] });
  if (!prompt.id) return null;

  const visMut = useMutation({
    mutationFn: (visibility: 'PUBLIC' | 'TEAM_PRIVATE') => promptApi.updateVisibility(prompt.id!, visibility),
    onSuccess: () => {
      toast({ kind: 'success', message: '已更新可见性' });
      invalidate();
    },
    onError: (e) => toast({ kind: 'error', message: e instanceof Error ? e.message : '更新可见性失败' }),
  });
  const statusMut = useMutation({
    mutationFn: (status: 'APPROVED' | 'UNLISTED') => promptApi.updateStatus(prompt.id!, status),
    onSuccess: () => {
      toast({ kind: 'success', message: '已更新状态' });
      invalidate();
    },
    onError: (e) => toast({ kind: 'error', message: e instanceof Error ? e.message : '更新状态失败' }),
  });
  const removeMut = useMutation({
    mutationFn: () => promptApi.remove(prompt.id!),
    onSuccess: () => {
      toast({ kind: 'success', message: '已删除 Prompt' });
      invalidate();
    },
    onError: (e) => toast({ kind: 'error', message: e instanceof Error ? e.message : '删除失败' }),
  });

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost"
          type="button"
          aria-label={`${prompt.name} 的更多操作`}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            right: 10,
            top: 10,
            width: 26,
            height: 26,
            display: 'grid',
            placeItems: 'center',
            border: `1px solid ${TOKENS.borderSoft}`,
            borderRadius: 6,
            background: '#fff',
            color: TOKENS.text3,
            cursor: 'pointer',
          }}
        >
          <I.more size={14} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content sideOffset={4} align="end" style={menuStyle()}>
          <DropdownMenu.Item onSelect={onOpen} style={menuItemStyle(false)}>
            <I.chevR size={11} /> 查看详情
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => nav(`/team/prompts/${prompt.id}/new-version`)} style={menuItemStyle(false)}>
            <I.layers size={11} /> 提交新版本
          </DropdownMenu.Item>
          {writer && (
            <>
              <DropdownMenu.Item onSelect={() => nav(`/team/prompts/${prompt.id}/edit?mode=profile`)} style={menuItemStyle(false)}>
                <I.cog size={11} /> 编辑信息
              </DropdownMenu.Item>
              {prompt.visibility === 'PUBLIC' ? (
                <DropdownMenu.Item onSelect={() => visMut.mutate('TEAM_PRIVATE')} style={menuItemStyle(false)}>
                  <I.lock size={11} /> 改为团队私有
                </DropdownMenu.Item>
              ) : (
                <DropdownMenu.Item onSelect={() => visMut.mutate('PUBLIC')} style={menuItemStyle(false)}>
                  <I.globe size={11} /> 改为公开
                </DropdownMenu.Item>
              )}
              {prompt.status === 'APPROVED' && (
                <DropdownMenu.Item onSelect={() => statusMut.mutate('UNLISTED')} style={menuItemStyle(false)}>
                  <I.arrowDn size={11} /> 下架
                </DropdownMenu.Item>
              )}
              {prompt.status === 'UNLISTED' && (
                <DropdownMenu.Item onSelect={() => statusMut.mutate('APPROVED')} style={menuItemStyle(false)}>
                  <I.arrowUp size={11} /> 重新上架
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Separator style={{ height: 1, background: TOKENS.borderSoft, margin: '4px 0' }} />
              <DropdownMenu.Item
                onSelect={() => {
                  if (window.confirm(`确认删除 Prompt「${prompt.name}」？`)) removeMut.mutate();
                }}
                style={{ ...menuItemStyle(false), color: TOKENS.danger }}
              >
                <I.trash size={11} /> 删除
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Segment<V extends string>({
  value,
  onChange,
  options,
}: {
  value: V;
  onChange: (value: V) => void;
  options: Array<[V, string]>;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 6,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      {options.map(([id, label]) => {
        const active = id === value;
        return (
          <Button variant="ghost"
            key={id}
            type="button"
            onClick={() => onChange(id)}
            style={{
              height: 30,
              padding: '0 10px',
              border: 0,
              borderRight: id === options[options.length - 1][0] ? 0 : `1px solid ${TOKENS.borderSoft}`,
              background: active ? TOKENS.primarySoft : '#fff',
              color: active ? TOKENS.primaryDeep : TOKENS.text2,
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}

function promptHref(prompt: PromptCardData, fallbackTeamSlug?: string) {
  return `/prompts/${prompt.teamSlug || fallbackTeamSlug || 'team'}/${prompt.slug}`;
}

function menuStyle(): React.CSSProperties {
  return {
    minWidth: 160,
    background: '#fff',
    border: `1px solid ${TOKENS.border}`,
    borderRadius: 8,
    padding: 4,
    boxShadow: '0 14px 32px rgba(15, 23, 42, 0.14)',
    zIndex: 50,
  };
}

function menuItemStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '7px 9px',
    borderRadius: 6,
    fontSize: 12.5,
    color: disabled ? TOKENS.text3 : TOKENS.text2,
    cursor: disabled ? 'not-allowed' : 'pointer',
    outline: 'none',
  };
}
