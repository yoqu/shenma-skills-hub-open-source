import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TOKENS, CATEGORIES } from '@/lib/tokens';
import { normalizeSlugInput, slugError, slugify } from '@/lib/slug';
import {
  Badge,
  Button,
  Card,
  DashTopBar,
  FormField,
  IconUpload,
  Input,
  PrefixInput,
  Select,
  TagsInput,
  Textarea,
  toast,
} from '@/components/ui';
import { TopBar } from '@/components/chrome/TopBar';
import { TeamSidebar } from '@/components/chrome/TeamSidebar';
import { I } from '@/components/icons';
import { useCategories, useCurrentTeam, useTeam, useTeamPrompts } from '@/api/data';
import { promptApi, reviewApi } from '@/api/endpoints';
import type { Visibility } from '@/mocks/skills';
import { PromptEditor } from './CreatePrompt/PromptEditor';
import { extractPromptRefs } from './CreatePrompt/promptMarkdown';

const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
interface PromptForm {
  name: string;
  slug: string;
  shortDesc: string;
  cat: string;
  version: string;
  visibility: Visibility;
  tags: string[];
  contentMd: string;
  changelog: string;
  /** 自定义上传图标 storage key（提交用） */
  iconKey?: string;
  /** 自定义上传图标完整 URL（预览用） */
  iconUrl?: string;
}

function defaultForm(teamSlug?: string): PromptForm {
  return {
    name: '',
    slug: '',
    shortDesc: '',
    cat: 'ai',
    version: '0.1.0',
    visibility: 'TEAM_PRIVATE',
    tags: [],
    contentMd: `# ${teamSlug ? `${teamSlug} ` : ''}Prompt\n\n请在这里编写提示词正文。\n`,
    changelog: 'initial',
  };
}

export default function CreatePrompt() {
  const nav = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { teamId, teamSlug } = useCurrentTeam();
  const { data: team } = useTeam();
  const { data: catsFromApi } = useCategories();
  const { data: teamPrompts = [] } = useTeamPrompts({ status: 'APPROVED', size: 100 });
  const [form, setForm] = useState<PromptForm>(() => defaultForm(teamSlug));
  const [touched, setTouched] = useState(false);
  const promptId = params.promptId ? Number(params.promptId) : undefined;
  const reviewId = params.reviewId ? Number(params.reviewId) : undefined;
  const mode: 'create' | 'version' | 'profile' | 'rework' = reviewId
    ? 'rework'
    : searchParams.get('mode') === 'profile'
      ? 'profile'
      : promptId
        ? 'version'
        : 'create';
  const editVersion = searchParams.get('version') || searchParams.get('editVersion') || undefined;

  const promptQuery = useQuery({
    queryKey: ['prompt-edit', promptId, editVersion],
    enabled: !!promptId,
    queryFn: async () => {
      const detail = await promptApi.detailById(promptId!);
      if (editVersion && editVersion !== detail.version) {
        const version = await promptApi.versionDetail(promptId!, editVersion);
        return { detail, contentMd: version.contentMd || detail.contentMd, version: version.version, changelog: version.changelog || '' };
      }
      return { detail, contentMd: detail.contentMd, version: detail.version, changelog: '' };
    },
  });

  const reviewQuery = useQuery({
    queryKey: ['review-rework', reviewId],
    enabled: !!reviewId,
    queryFn: () => reviewApi.detail(reviewId!),
  });

  useEffect(() => {
    if (!promptQuery.data) return;
    const { detail, contentMd, version, changelog } = promptQuery.data;
    setForm({
      name: detail.name,
      slug: detail.slug,
      shortDesc: detail.shortDesc || '',
      cat: detail.cat || 'ai',
      version: nextVersion(version || '0.1.0'),
      visibility: detail.visibility,
      tags: detail.tags || [],
      contentMd,
      changelog: mode === 'profile' ? changelog || 'update profile' : 'update prompt',
      iconUrl: detail.iconUrl ?? undefined,
    });
  }, [promptQuery.data, mode]);

  useEffect(() => {
    if (mode !== 'rework' || !reviewQuery.data) return;
    const detail = reviewQuery.data as {
      targetType?: string;
      name?: string;
      slug?: string;
      shortDesc?: string;
      catCode?: string;
      version?: string;
      visibility?: string;
      tags?: string[];
      payloadJson?: string;
      changelog?: string;
      iconUrl?: string;
    };
    if (detail.targetType && detail.targetType !== 'PROMPT') {
      toast({ kind: 'error', message: '该审核记录不是 Prompt，无法在此页面修改' });
      nav('/team/mine');
      return;
    }
    let payload: Partial<PromptForm> = {};
    if (detail.payloadJson) {
      try {
        const raw = JSON.parse(detail.payloadJson);
        payload = {
          name: raw.name,
          slug: raw.slug,
          shortDesc: raw.shortDesc,
          cat: raw.cat,
          visibility: raw.visibility,
          version: raw.version,
          tags: raw.tags,
          contentMd: raw.contentMd,
          changelog: raw.changelog,
        };
      } catch {
        // payloadJson 损坏时直接降级到 detail 字段
      }
    }
    setForm({
      name: payload.name || detail.name || '',
      slug: payload.slug || detail.slug || '',
      shortDesc: payload.shortDesc || detail.shortDesc || '',
      cat: payload.cat || detail.catCode || 'ai',
      version: payload.version || detail.version || '0.1.0',
      visibility: (payload.visibility || detail.visibility || 'TEAM_PRIVATE') as Visibility,
      tags: payload.tags || detail.tags || [],
      contentMd: payload.contentMd || '',
      changelog: payload.changelog || detail.changelog || '',
      iconUrl: detail.iconUrl ?? undefined,
    });
  }, [mode, reviewQuery.data, nav]);

  const cats = useMemo(
    () =>
      (catsFromApi && catsFromApi.length > 0
        ? catsFromApi.map((c) => ({ id: String(c.id), name: c.name }))
        : CATEGORIES.map((c) => ({ id: c.id, name: c.name }))
      ).filter((c) => c.id !== 'all'),
    [catsFromApi],
  );

  const refs = useMemo(() => extractPromptRefs(form.contentMd), [form.contentMd]);
  const errors = validate(form);
  const canSubmit = Object.keys(errors).length === 0 && !!teamId;
  const reviewMode = team?.reviewMode ?? 'REVIEW_REQUIRED';
  const directPublish = reviewMode === 'DIRECT_PUBLISH';

  const createPrompt = useMutation({
    mutationFn: async (draft: boolean) => {
      if (!teamId) throw new Error('当前未选中团队');
      if (mode === 'profile') {
        if (!promptId) throw new Error('缺少 Prompt ID');
        return promptApi.updateAdminProfile(promptId, {
          name: form.name,
          shortDesc: form.shortDesc,
          cat: form.cat,
          visibility: form.visibility,
          tags: form.tags,
          iconKey: form.iconKey,
        }).then(() => ({ id: promptId, slug: form.slug, status: 'APPROVED', pendingReview: false }));
      }
      if (mode === 'version') {
        if (!promptId) throw new Error('缺少 Prompt ID');
        return promptApi.submitVersion(promptId, {
          version: form.version,
          contentMd: form.contentMd,
          changelog: form.changelog,
          tags: form.tags,
        });
      }
      if (mode === 'rework') {
        if (!reviewId) throw new Error('缺少 review ID');
        await reviewApi.resubmit(reviewId, {
          name: form.name,
          slug: form.slug,
          shortDesc: form.shortDesc,
          cat: form.cat,
          visibility: form.visibility,
          version: form.version,
          tags: form.tags,
          contentMd: form.contentMd,
          changelog: form.changelog,
          iconKey: form.iconKey,
        });
        return { id: reviewId, slug: form.slug, status: 'PENDING_REVIEW', pendingReview: true };
      }
      const { iconUrl: _iconUrl, ...rest } = form;
      const payload = { ...rest, teamId };
      return draft ? promptApi.saveDraft(payload) : promptApi.create(payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['team-prompts', teamId] });
      queryClient.invalidateQueries({ queryKey: ['prompts', 'public'] });
      queryClient.invalidateQueries({ queryKey: ['reviews', teamId] });
      queryClient.invalidateQueries({ queryKey: ['review-rework', reviewId] });
      const message =
        mode === 'profile'
          ? 'Prompt 信息已更新'
          : mode === 'rework'
            ? 'Prompt 已重新提交审核'
            : res.pendingReview
              ? 'Prompt 已提交审核'
              : 'Prompt 已发布';
      toast({ kind: 'success', message });
      if (mode === 'rework' || res.status === 'DRAFT') {
        // 草稿 / 改稿重提都回到「我的提交」，草稿 tab 才能立刻看到这条记录
        nav('/team/mine');
      } else {
        nav(res.pendingReview ? '/team/reviews' : '/team/prompts');
      }
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `提交失败：${err.message}` : '提交失败',
      });
    },
  });

  function set<K extends keyof PromptForm>(key: K, value: PromptForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function insertMention(prompt: { name: string; slug: string; teamSlug?: string }) {
    const targetTeam = prompt.teamSlug || teamSlug;
    if (!targetTeam) return;
    const text = `@[${prompt.name}](skillstack://prompt/${targetTeam}/${prompt.slug})`;
    set('contentMd', `${form.contentMd.trimEnd()}\n\n${text} `);
  }

  function submit(draft: boolean) {
    setTouched(true);
    if (!teamId) {
      toast({ kind: 'error', message: '当前未选择团队，无法提交' });
      return;
    }
    const firstError = Object.values(errors)[0];
    if (firstError) {
      toast({ kind: 'error', message: firstError });
      return;
    }
    createPrompt.mutate(draft);
  }

  const reworkStatus = (reviewQuery.data as { status?: string } | undefined)?.status;
  const reworkReason = (reviewQuery.data as { reason?: string } | undefined)?.reason;
  const pageTitle =
    mode === 'profile'
      ? '编辑 Prompt 信息'
      : mode === 'version'
        ? '提交 Prompt 新版本'
        : mode === 'rework'
          ? '修改并重新提交 Prompt'
          : '创建 Prompt';
  const pageHint =
    mode === 'profile'
      ? '维护已上线 Prompt 的展示信息；历史版本仍只读'
      : mode === 'rework'
        ? reworkStatus === 'REJECTED'
          ? '审核已被驳回 — 修改后可重新提交'
          : reworkStatus === 'CHANGES_REQUESTED'
            ? '审核人请求修改 — 修改后可重新提交'
            : '修改并重新提交审核'
        : directPublish
          ? '团队当前为直接发布模式'
          : '提交后进入团队审核队列';
  const contentLocked = mode === 'profile';
  const metaLocked = mode === 'version';
  const changelogLocked = mode === 'profile';
  const submitButtonLabel = createPrompt.isPending
    ? '提交中…'
    : mode === 'profile'
      ? '保存信息'
      : mode === 'rework'
        ? '重新提交审核'
        : directPublish
          ? '发布 Prompt'
          : '提交审核';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: TOKENS.bgAlt }}>
      <TopBar active="myteam" authed />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <TeamSidebar active="prompts" />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <DashTopBar
            title={pageTitle}
            hint={pageHint}
            actions={
              <>
                <Button variant="ghost" size="sm" onClick={() => nav(-1)}>
                  取消
                </Button>
                {mode === 'create' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => submit(true)}
                    disabled={createPrompt.isPending}
                    title={canSubmit ? undefined : '请检查必填项是否填写完整且格式正确'}
                  >
                    保存草稿
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  icon={<I.check size={12} />}
                  onClick={() => submit(false)}
                  disabled={createPrompt.isPending}
                  title={canSubmit ? undefined : '请检查必填项是否填写完整且格式正确'}
                >
                  {submitButtonLabel}
                </Button>
              </>
            }
          />

          <div
            style={{
              padding: '24px 32px 40px',
              overflow: 'auto',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 340px',
              gap: 16,
            }}
          >
            <main style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
              {mode === 'rework' && reworkReason && (
                <Card pad={14} style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <I.x size={16} style={{ color: TOKENS.danger, marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.danger, marginBottom: 4 }}>
                        {reworkStatus === 'CHANGES_REQUESTED' ? '审核人请求修改' : '审核未通过'}
                      </div>
                      <div style={{ fontSize: 12.5, color: TOKENS.text2, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                        {reworkReason}
                      </div>
                    </div>
                  </div>
                </Card>
              )}
              <Card pad={18}>
                <FormField label="图标" hint="可选 · 不上传则用默认图标">
                  <IconUpload
                    currentUrl={form.iconUrl}
                    size={64}
                    disabled={metaLocked || createPrompt.isPending}
                    fallback={
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 16,
                          background: TOKENS.bgGray,
                          color: TOKENS.primary,
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <I.code size={26} />
                      </div>
                    }
                    upload={async (file) => promptApi.uploadIcon(file)}
                    onChange={(key, url) =>
                      setForm((prev) => ({ ...prev, iconKey: key ?? undefined, iconUrl: url ?? undefined }))
                    }
                  />
                </FormField>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, margin: '14px 0' }}>
                  <FormField label="名称" required error={touched ? errors.name : undefined}>
                    <Input
                      value={form.name}
                      disabled={metaLocked}
                      onChange={(e) => {
                        const name = e.target.value;
                        const nextSlug = slugify(name);
                        setForm((prev) => ({
                          ...prev,
                          name,
                          slug: prev.slug || nextSlug,
                        }));
                      }}
                      placeholder="例如 代码评审上下文"
                      maxLength={128}
                    />
                  </FormField>
                  <FormField
                    label="slug"
                    required
                    error={touched ? errors.slug : undefined}
                    hint={`引用路径: skillstack://prompt/${teamSlug || 'team'}/${form.slug || 'slug'}`}
                  >
                    <PrefixInput
                      prefix={`${teamSlug || 'team'} /`}
                      value={form.slug}
                      onChange={(value) => set('slug', normalizeSlugInput(value))}
                      disabled={mode === 'version' || mode === 'profile'}
                      state={touched && errors.slug ? 'error' : 'default'}
                      placeholder="my-prompt"
                    />
                  </FormField>
                </div>
                <FormField label="一句话描述" required error={touched ? errors.shortDesc : undefined}>
                  <Input
                    value={form.shortDesc}
                    disabled={metaLocked}
                    onChange={(e) => set('shortDesc', e.target.value)}
                    placeholder="说明这个 Prompt 解决什么问题"
                    maxLength={120}
                  />
                </FormField>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
                  <FormField label="分类" required error={touched ? errors.cat : undefined}>
                    <Select
                      value={form.cat}
                      disabled={metaLocked}
                      onChange={(e) => set('cat', e.target.value)}
                      placeholder="请选择分类"
                      options={cats.map((c) => ({ value: c.id, label: c.name }))}
                    />
                  </FormField>
                  <FormField label="版本" required error={touched ? errors.version : undefined}>
                    <Input
                      value={form.version}
                      onChange={(e) => set('version', e.target.value)}
                      disabled={mode === 'profile'}
                      placeholder="0.1.0"
                      style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}
                    />
                  </FormField>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
                  <FormField label="可见性" required>
                    <Select
                      value={form.visibility}
                      disabled={metaLocked}
                      onChange={(e) => set('visibility', e.target.value as Visibility)}
                      options={[
                        { value: 'TEAM_PRIVATE', label: '团队私有' },
                        { value: 'PUBLIC', label: '公开' },
                      ]}
                    />
                  </FormField>
                  <FormField label="标签" hint="回车 / 逗号 / 空格加入，最多 8 个">
                    <TagsInput
                      value={form.tags}
                      onChange={(tags) => set('tags', tags)}
                      disabled={metaLocked}
                      maxTags={8}
                      maxTagLength={24}
                      placeholder="prompt, review, agent"
                    />
                  </FormField>
                </div>
              </Card>

              <Card pad={0}>
                <PromptEditor
                  value={form.contentMd}
                  onChange={(markdown) => set('contentMd', markdown)}
                  placeholder="编写 Prompt Markdown，使用右侧列表插入 @prompt 引用"
                  promptCount={refs.length}
                  disabled={createPrompt.isPending || contentLocked}
                />
                {touched && errors.contentMd && (
                  <div style={{ padding: '0 14px 12px', color: TOKENS.danger, fontSize: 12 }}>{errors.contentMd}</div>
                )}
              </Card>

              <Card pad={16}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>引用检查</div>
                <RefsPreview refs={refs} visibility={form.visibility} />
              </Card>
            </main>

            <aside style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
              <Card pad={16}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>可引用 Prompt</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflow: 'auto' }}>
                  {teamPrompts.filter((p) => p.slug !== form.slug).map((p) => (
                    <Button variant="ghost"
                      key={p.slug}
                      type="button"
                      onClick={() => insertMention(p)}
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        border: `1px solid ${TOKENS.borderSoft}`,
                        borderRadius: 6,
                        background: '#fff',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <I.code size={12} style={{ color: TOKENS.primary }} />
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: TOKENS.text }}>{p.name}</span>
                        {p.visibility === 'TEAM_PRIVATE' && <I.lock size={11} style={{ color: TOKENS.text3, marginLeft: 'auto' }} />}
                      </div>
                      <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 2 }}>
                        {p.teamSlug || teamSlug}/{p.slug} · v{p.version}
                      </div>
                    </Button>
                  ))}
                  {teamPrompts.length === 0 && (
                    <div style={{ fontSize: 12, color: TOKENS.text3, lineHeight: 1.6 }}>
                      当前团队还没有已发布 Prompt，保存后即可被其他 Prompt 引用。
                    </div>
                  )}
                </div>
              </Card>
              <Card pad={16}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>提交信息</div>
                <FormField label="版本说明">
                  <Textarea
                    value={form.changelog}
                    onChange={(e) => set('changelog', e.target.value)}
                    disabled={changelogLocked}
                    style={{ minHeight: 84, fontSize: 12.5 }}
                    maxLength={1024}
                  />
                </FormField>
              </Card>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );

}

function validate(form: PromptForm): Partial<Record<keyof PromptForm, string>> {
  const errors: Partial<Record<keyof PromptForm, string>> = {};
  if (!form.name.trim()) errors.name = '请输入 Prompt 名称';
  errors.slug = slugError(form.slug);
  if (!form.shortDesc.trim()) errors.shortDesc = '请填写一句话描述';
  if (!form.cat) errors.cat = '请选择分类';
  if (!SEMVER_RE.test(form.version)) errors.version = '需符合 SemVer，例如 0.1.0';
  if (!form.contentMd.trim()) errors.contentMd = 'Prompt 内容不能为空';
  return errors;
}

function nextVersion(version: string) {
  const [major, minor, patch] = version.split('.').map((part) => Number.parseInt(part, 10));
  if ([major, minor, patch].some((n) => Number.isNaN(n))) return version;
  return `${major}.${minor}.${patch + 1}`;
}

function RefsPreview({
  refs,
  visibility,
}: {
  refs: Array<{ label: string; teamSlug: string; slug: string }>;
  visibility: Visibility;
}) {
  if (refs.length === 0) {
    return <div style={{ fontSize: 12.5, color: TOKENS.text3 }}>当前内容没有引用其他 Prompt。</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {refs.map((ref, idx) => (
        <div
          key={`${ref.teamSlug}-${ref.slug}-${idx}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            border: `1px solid ${TOKENS.borderSoft}`,
            borderRadius: 6,
            background: '#fff',
            fontSize: 12.5,
          }}
        >
          <Badge tone="primary" size="sm">#{idx + 1}</Badge>
          <span style={{ fontWeight: 600 }}>{ref.label}</span>
          <code style={{ color: TOKENS.text3 }}>{ref.teamSlug}/{ref.slug}</code>
          {visibility === 'PUBLIC' && (
            <span style={{ marginLeft: 'auto', color: TOKENS.warning, fontSize: 11 }}>
              公开 Prompt 发布时会校验不能引用私有 Prompt
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
