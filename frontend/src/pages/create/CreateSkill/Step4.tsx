import { useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { Badge, Button, SectionHeader, SkillIcon } from '@/components/ui';
import { I, type IconProps } from '@/components/icons';
import { useCurrentTeam, useTeam } from '@/api/data';
import { skillApi } from '@/api/endpoints';
import type { Visibility } from '@/mocks/skills';
import type { SkillMeta, SkillParseResult, UploadInfo } from './types';

interface VisOpt {
  v: Visibility;
  icon: ComponentType<IconProps>;
  name: string;
  desc: string;
}

function buildOpts(teamName: string): VisOpt[] {
  return [
    {
      v: 'TEAM_PRIVATE',
      icon: I.lock,
      name: '团队私有',
      desc: `仅 ${teamName || '本团队'} 成员可见与安装`,
    },
    {
      v: 'PUBLIC',
      icon: I.globe,
      name: '公开发布',
      desc: '任何人都能在 Skills 广场搜索、查看与安装',
    },
  ];
}

function SubmitPreview({ meta, vis }: { meta: SkillMeta; vis: Visibility }) {
  const initial = meta.name.slice(0, 1).toUpperCase() || 'S';
  return (
    <div style={{ padding: 14, background: TOKENS.bgAlt, borderRadius: 8 }}>
      <div
        style={{
          fontSize: 11,
          color: TOKENS.text3,
          fontWeight: 600,
          marginBottom: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        预览
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SkillIcon ch={initial} cat={meta.category} url={meta.iconUrl} size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{meta.name || '(未命名)'}</span>
            <Badge tone={vis === 'PUBLIC' ? 'primary' : 'info'} size="sm">
              {vis === 'PUBLIC' ? '公开' : '私有'}
            </Badge>
            <code
              style={{
                fontSize: 11,
                color: TOKENS.text3,
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              }}
            >
              v{meta.version || '0.0.0'}
            </code>
          </div>
          <div style={{ fontSize: 12, color: TOKENS.text2, marginTop: 2, lineHeight: 1.55 }}>
            {meta.description || '(未填描述)'}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface Step4Props {
  meta: SkillMeta;
  setMeta: (m: SkillMeta) => void;
  upload: UploadInfo | null;
  parseResult?: SkillParseResult | null;
  onBack: () => void;
}

export function Step4Submit({ meta, setMeta, upload, parseResult, onBack }: Step4Props) {
  const nav = useNavigate();
  const { teamId } = useCurrentTeam();
  const { data: teamDetail } = useTeam();
  const [submitted, setSubmitted] = useState(false);
  const [createdSlug, setCreatedSlug] = useState(meta.slug);
  const [createdStatus, setCreatedStatus] = useState<'PENDING_REVIEW' | 'APPROVED' | string>('PENDING_REVIEW');
  const queryClient = useQueryClient();

  const vis = meta.visibility;
  const setVis = (v: Visibility) => setMeta({ ...meta, visibility: v });

  function buildPayload() {
    if (!teamId) throw new Error('当前未选中团队,无法提交');
    const langs = parseResult?.parsed?.langs?.filter((l): l is string => !!l) ?? [];
    return {
      name: meta.name,
      slug: meta.slug,
      shortDesc: meta.description,
      descriptionMd: meta.descriptionMd,
      cat: meta.category,
      visibility: vis,
      version: meta.version,
      teamId,
      icon: meta.name.slice(0, 1).toUpperCase() || 'S',
      iconKey: meta.iconKey,
      tags: meta.tags,
      langs,
      files: upload ? [{ path: upload.fileName, size: upload.size }] : undefined,
      fileCount: parseResult?.fileCount,
      zipUrl: upload?.zipUrl,
    };
  }

  const createSkill = useMutation({
    mutationFn: () => skillApi.create(buildPayload()),
    onSuccess: (res) => {
      setCreatedSlug(res.slug);
      setCreatedStatus(res.status ?? 'PENDING_REVIEW');
      queryClient.invalidateQueries({ queryKey: ['team-skills', teamId] });
      queryClient.invalidateQueries({ queryKey: ['reviews', teamId] });
      queryClient.invalidateQueries({ queryKey: ['my-drafts'] });
      setSubmitted(true);
    },
  });

  const saveDraft = useMutation({
    mutationFn: () => skillApi.saveDraft(buildPayload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-drafts'] });
      nav('/team/mine');
    },
  });

  const reviewMode = teamDetail?.reviewMode ?? 'REVIEW_REQUIRED';
  const willPublishDirectly = reviewMode === 'DIRECT_PUBLISH';
  const teamName = teamDetail?.name ?? '';
  const opts = buildOpts(teamName);

  const submitDisabled = createSkill.isPending || !teamId || !upload;
  const submit = () => createSkill.mutate();

  if (submitted) {
    const headline =
      createdStatus === 'APPROVED' || willPublishDirectly ? '已发布' : '已提交审核';
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <div
          style={{
            width: 72,
            height: 72,
            margin: '0 auto 16px',
            borderRadius: '50%',
            background: TOKENS.successSoft,
            color: TOKENS.success,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <I.check size={36} stroke={2.5} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>{headline}</h2>
        <div
          style={{
            fontSize: 13,
            color: TOKENS.text2,
            maxWidth: 440,
            margin: '0 auto 24px',
            lineHeight: 1.6,
          }}
        >
          {headline === '已发布' ? (
            <>团队当前为直接发布模式,已立即对{vis === 'PUBLIC' ? '所有人' : '团队成员'}可见。</>
          ) : (
            <>Skill 已进入审核队列。Owner / Admin 处理后,提交者会收到通知。</>
          )}
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: 16,
            background: TOKENS.bgAlt,
            borderRadius: 10,
          }}
        >
          <SkillIcon ch={meta.name.slice(0, 1).toUpperCase() || 'S'} cat={meta.category} url={meta.iconUrl} size={40} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{meta.name}</div>
            <div
              style={{
                fontSize: 11.5,
                color: TOKENS.text3,
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              }}
            >
              {meta.team}/{createdSlug} · v{meta.version}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 24 }}>
          <Button variant="ghost" size="md" onClick={() => nav('/team/mine')}>
            我的草稿/提交
          </Button>
          <Button variant="primary" size="md" onClick={() => nav('/team/skills')}>
            回到 Skill 库
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="可见性与提交"
        hint="选择 Skill 对谁可见 · 决定后续是否能在 Skills 广场被发现"
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {opts.map((opt) => {
          const Ico = opt.icon;
          const active = vis === opt.v;
          return (
            <button
              key={opt.v}
              type="button"
              onClick={() => setVis(opt.v)}
              style={{
                padding: 14,
                textAlign: 'left',
                cursor: 'pointer',
                background: active ? TOKENS.primarySoft : '#fff',
                border: `1.5px solid ${active ? TOKENS.primary : TOKENS.border}`,
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontFamily: 'inherit',
                minHeight: 84,
                width: '100%',
                alignItems: 'stretch',
                justifyContent: 'flex-start',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                <Ico size={16} style={{ color: active ? TOKENS.primary : TOKENS.text2 }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{opt.name}</span>
                {opt.v === 'PUBLIC' && (
                  <Badge tone="warning" size="sm" style={{ marginLeft: 'auto', fontSize: 10 }}>
                    对外可见
                  </Badge>
                )}
              </div>
              <div style={{ fontSize: 12, color: TOKENS.text2, lineHeight: 1.55 }}>{opt.desc}</div>
            </button>
          );
        })}
      </div>

      <div
        style={{
          padding: 14,
          background: willPublishDirectly ? TOKENS.warningSoft : TOKENS.primarySoft,
          border: `1px solid ${
            willPublishDirectly ? TOKENS.warning + '55' : TOKENS.primary + '33'
          }`,
          borderRadius: 8,
          display: 'flex',
          gap: 10,
          fontSize: 12.5,
          marginBottom: 16,
        }}
      >
        <I.shield
          size={14}
          style={{
            color: willPublishDirectly ? TOKENS.warning : TOKENS.primary,
            marginTop: 2,
            flex: '0 0 auto',
          }}
        />
        <div style={{ color: TOKENS.text2, lineHeight: 1.6 }}>
          {willPublishDirectly ? (
            <>
              团队审核模式为 <b>直接发布</b>,提交即生效。
            </>
          ) : (
            <>
              团队审核模式为 <b>需要审核</b>,提交后会进入审核队列,等待 Owner / Admin 处理。
            </>
          )}
        </div>
      </div>

      {!upload && (
        <div
          style={{
            padding: 12,
            marginBottom: 12,
            borderRadius: 8,
            background: TOKENS.warningSoft,
            border: `1px solid ${TOKENS.warning}55`,
            color: TOKENS.text2,
            fontSize: 12.5,
          }}
        >
          还未在第 1 步上传压缩包,无法提交;请点击「返回」补全。
        </div>
      )}
      {!teamId && (
        <div
          style={{
            padding: 12,
            marginBottom: 12,
            borderRadius: 8,
            background: TOKENS.dangerSoft,
            border: `1px solid ${TOKENS.danger}33`,
            color: TOKENS.danger,
            fontSize: 12.5,
          }}
        >
          当前没有选中团队,无法创建 Skill。请先选择一个团队再回到本页。
        </div>
      )}

      <SubmitPreview meta={meta} vis={vis} />

      {(createSkill.isError || saveDraft.isError) && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 8,
            background: TOKENS.dangerSoft,
            border: `1px solid ${TOKENS.danger}33`,
            color: TOKENS.danger,
            fontSize: 12.5,
          }}
        >
          {createSkill.isError
            ? `提交失败: ${(createSkill.error as Error).message}`
            : `保存草稿失败: ${(saveDraft.error as Error).message}`}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <Button variant="ghost" size="md" onClick={onBack}>
          ← 返回
        </Button>
        <span style={{ flex: 1 }} />
        <Button
          variant="secondary"
          size="md"
          onClick={() => saveDraft.mutate()}
          disabled={saveDraft.isPending || !teamId}
        >
          {saveDraft.isPending ? '保存中…' : '保存为草稿'}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={submit}
          disabled={submitDisabled}
          icon={<I.check size={12} />}
        >
          {createSkill.isPending ? '提交中…' : willPublishDirectly ? '确认发布' : '提交审核'}
        </Button>
      </div>
    </div>
  );
}
