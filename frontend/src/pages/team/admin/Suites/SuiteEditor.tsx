import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { fmt } from '@/lib/utils';
import { Badge, Button, Card, SearchInput, SectionHeader, SkillIcon, toast } from '@/components/ui';
import { I } from '@/components/icons';
import { useCurrentTeam, mapSkill, useTeamPrompts, useTeamSkills } from '@/api/data';
import { suiteApi, type SuiteAssetItemRes } from '@/api/endpoints';
import type { Skill } from '@/mocks/skills';
import type { Suite } from '@/mocks/suites';

export interface SuiteEditorProps {
  suite: Suite;
}

type AssetItem = {
  type: 'SKILL' | 'PROMPT';
  id?: number;
  slug: string;
  name: string;
  shortDesc?: string;
  cat?: string;
  version?: string;
  visibility?: string;
  installs?: number;
  exports?: number;
  icon?: string;
  iconUrl?: string;
  authorName?: string;
};

export function SuiteEditor({ suite }: SuiteEditorProps) {
  const { teamId } = useCurrentTeam();
  const teamIdNum = teamId ? Number(teamId) : undefined;
  const { data: detail } = useQuery({
    queryKey: ['suite-detail', teamIdNum, suite.slug],
    enabled: Number.isFinite(teamIdNum),
    queryFn: () => suiteApi.detailByTeamSlug(teamIdNum!, suite.slug),
  });
  const initial = useMemo(() => {
    const mixed = Array.isArray((detail as any)?.items) ? ((detail as any).items as SuiteAssetItemRes[]) : [];
    if (mixed.length > 0) return mixed.map(assetFromSuite);
    const items = Array.isArray((detail as any)?.skills) ? (detail as any).skills : [];
    return items.map((s: unknown) => assetFromSkill(mapSkill(s)));
  }, [detail]);
  const [selected, setSelected] = useState<AssetItem[]>([]);
  const { data: allSkills = [] } = useTeamSkills({ size: 50 });
  const { data: allPrompts = [] } = useTeamPrompts({ status: 'APPROVED', size: 50 });
  const queryClient = useQueryClient();
  const saveItems = useMutation({
    mutationFn: () =>
      suiteApi.updateItems(Number(suite.id), {
        items: selected
          .filter((s) => typeof s.id === 'number')
          .map((s, idx) => ({
            type: s.type,
            itemId: s.id!,
            skillId: s.type === 'SKILL' ? s.id! : undefined,
            position: idx + 1,
          })),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suite-detail', teamIdNum, suite.slug] });
      queryClient.invalidateQueries({ queryKey: ['suites', teamId] });
      toast({ kind: 'success', message: '套件内容已保存' });
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `保存失败：${err.message}` : '保存失败',
      });
    },
  });

  useEffect(() => {
    setSelected(initial);
  }, [initial]);

  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const available = [
    ...allSkills.map(assetFromSkill),
    ...allPrompts.map((p) => ({
      type: 'PROMPT' as const,
      id: p.id,
      slug: p.slug,
      name: p.name,
      shortDesc: p.shortDesc,
      cat: p.cat,
      version: p.version,
      visibility: p.visibility,
      exports: p.exports,
    })),
  ].filter((s) => !selected.find((x) => assetKey(x) === assetKey(s)));

  function move(from: number, to: number) {
    const next = [...selected];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setSelected(next);
  }
  function remove(key: string) {
    setSelected(selected.filter((s) => assetKey(s) !== key));
  }
  function add(asset: AssetItem) {
    setSelected([...selected, asset]);
  }

  return (
    <div style={{ overflow: 'auto', padding: '20px 28px 40px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${TOKENS.primary}, #7C3AED)`,
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            flex: '0 0 auto',
          }}
        >
          <I.layers size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{suite.name}</h2>
            <Badge tone={suite.visibility === 'PUBLIC' ? 'primary' : 'info'} size="sm">
              {suite.visibility === 'PUBLIC' ? '公开' : '团队私有'}
            </Badge>
            <code
              style={{
                fontSize: 11,
                color: TOKENS.text3,
                padding: '2px 6px',
                background: TOKENS.bgGray,
                borderRadius: 4,
              }}
            >
              {suite.slug}
            </code>
          </div>
          <div style={{ fontSize: 13, color: TOKENS.text2, lineHeight: 1.6 }}>
            {suite.desc}
          </div>
        </div>
        <Button
          variant="primary"
          size="md"
          icon={<I.check size={12} />}
          disabled={saveItems.isPending}
          onClick={() => saveItems.mutate()}
        >
          {saveItems.isPending ? '保存中…' : '保存'}
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <Card pad={16}>
          <SectionHeader
            title="套件中的资产"
            hint={`${selected.length} 个 · Skill 安装，Prompt 导出 Markdown · 拖拽手柄可调整`}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {selected.map((s, idx) => (
              <SuiteRow
                key={assetKey(s)}
                asset={s}
                idx={idx}
                dragging={draggingIdx === idx}
                onDragStart={() => setDraggingIdx(idx)}
                onDragEnd={() => setDraggingIdx(null)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggingIdx !== null && draggingIdx !== idx) {
                    move(draggingIdx, idx);
                    setDraggingIdx(idx);
                  }
                }}
                onRemove={() => remove(assetKey(s))}
              />
            ))}
          </div>
          <SuiteInstallPreview suite={suite} count={selected.length} teamId={teamId} />
        </Card>
        <SuitePicker available={available} onAdd={add} />
      </div>
    </div>
  );
}

interface SuiteRowProps {
  asset: AssetItem;
  idx: number;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onRemove: () => void;
}

function SuiteRow({
  asset,
  idx,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onRemove,
}: SuiteRowProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        border: `1px solid ${dragging ? TOKENS.primary : TOKENS.border}`,
        background: dragging ? TOKENS.primarySoft : '#fff',
        borderRadius: 8,
        cursor: dragging ? 'grabbing' : 'default',
        opacity: dragging ? 0.6 : 1,
        transition: 'background .12s',
      }}
    >
      <div style={{ cursor: 'grab', color: TOKENS.text3, padding: 2 }}>
        <I.drag size={14} />
      </div>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 4,
          background: TOKENS.bgGray,
          color: TOKENS.text2,
          fontSize: 11,
          fontWeight: 600,
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'monospace',
        }}
      >
        {idx + 1}
      </div>
      {asset.type === 'PROMPT' ? (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: TOKENS.bgGray,
            color: TOKENS.primary,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <I.code size={14} />
        </div>
      ) : (
        <SkillIcon
          ch={asset.icon ?? (asset.name.slice(0, 1).toUpperCase() || 'S')}
          cat={asset.cat}
          url={asset.iconUrl}
          size={28}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {asset.name}
        </div>
        <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 2 }}>
          v{asset.version} · {asset.type === 'PROMPT' ? 'Prompt' : asset.authorName}
        </div>
      </div>
      <Badge tone={asset.type === 'PROMPT' ? 'primary' : 'neutral'} size="sm" style={{ fontSize: 10 }}>
        {asset.type}
      </Badge>
      <Button variant="ghost"
        type="button"
        onClick={onRemove}
        aria-label={`从套件中移除 ${asset.name}`}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: TOKENS.text3,
          padding: 4,
        }}
      >
        <I.x size={14} />
      </Button>
    </div>
  );
}

function SuiteInstallPreview({ suite, count, teamId }: { suite: Suite; count: number; teamId?: number }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          fontSize: 11,
          color: TOKENS.text3,
          marginBottom: 6,
          fontWeight: 500,
        }}
      >
        用户安装命令
      </div>
      <div
        style={{
          padding: '12px 14px',
          background: '#0F172A',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontSize: 12.5,
          color: '#E2E8F0',
          borderRadius: 8,
        }}
      >
        <div>
          <span style={{ color: '#A78BFA' }}>$</span> smskill suite install{' '}
          <span style={{ color: '#86EFAC' }}>{teamId ?? '<teamId>'}/{suite.slug}</span>
        </div>
        <div style={{ color: '#64748B', marginTop: 6, fontSize: 11 }}>
          → {count} 个资产将按顺序处理，Prompt 会导出为 Markdown
        </div>
      </div>
    </div>
  );
}

function SuitePicker({
  available,
  onAdd,
}: {
  available: AssetItem[];
  onAdd: (s: AssetItem) => void;
}) {
  const [q, setQ] = useState('');
  const filtered = available.filter(
    (s) => !q || s.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <Card pad={16}>
      <SectionHeader
        title="添加资产"
        hint={`${available.length} 个可选 · Skill / Prompt`}
      />
      <div style={{ marginBottom: 10 }}>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索 Skill 或 Prompt…"
          style={{
            height: 30,
            padding: '0 10px 0 30px',
            fontSize: 12,
            borderRadius: 6,
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          maxHeight: 380,
          overflow: 'auto',
        }}
      >
        {filtered.map((s) => (
          <div
            key={assetKey(s)}
            onClick={() => onAdd(s)}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = TOKENS.bgAlt;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'transparent';
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {s.type === 'PROMPT' ? (
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: TOKENS.bgGray,
                  color: TOKENS.primary,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <I.code size={13} />
              </div>
            ) : (
              <SkillIcon
                ch={s.icon ?? (s.name.slice(0, 1).toUpperCase() || 'S')}
                cat={s.cat}
                url={s.iconUrl}
                size={26}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.name}
              </div>
              <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 1 }}>
                {s.type === 'PROMPT' ? `${s.exports ?? 0} exports` : fmt(s.installs ?? 0)} · v{s.version}
              </div>
            </div>
            <I.plus size={14} style={{ color: TOKENS.primary }} />
          </div>
        ))}
        {filtered.length === 0 && (
          <div
            style={{
              padding: '24px 0',
              textAlign: 'center',
              fontSize: 12,
              color: TOKENS.text3,
            }}
          >
            没有匹配的资产
          </div>
        )}
      </div>
    </Card>
  );
}

function assetFromSkill(skill: Skill & { id?: number }): AssetItem {
  return {
    type: 'SKILL',
    id: skill.id,
    slug: skill.slug,
    name: skill.name,
    shortDesc: skill.short,
    cat: skill.cat,
    version: skill.version,
    visibility: skill.visibility,
    installs: skill.installs,
    icon: skill.icon,
    iconUrl: skill.iconUrl,
    authorName: skill.author.name,
  };
}

function assetFromSuite(item: SuiteAssetItemRes): AssetItem {
  return {
    type: item.type,
    id: item.id,
    slug: item.slug,
    name: item.name,
    shortDesc: item.shortDesc,
    cat: item.catCode,
    version: item.version,
    visibility: item.visibility,
    installs: item.installs,
    exports: item.exports,
    icon: item.type === 'SKILL'
      ? (item.icon ?? item.name.slice(0, 1).toUpperCase())
      : undefined,
    iconUrl: item.type === 'SKILL' ? item.iconUrl : undefined,
  };
}

function assetKey(item: Pick<AssetItem, 'type' | 'slug'>) {
  return `${item.type}:${item.slug}`;
}
