import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { TOKENS, CATEGORIES } from '@/lib/tokens';
import { Button, SectionHeader, FormField, IconUpload, Input, PrefixInput, Select, SkillIcon, TagsInput } from '@/components/ui';
import { I } from '@/components/icons';
import { useCategories } from '@/api/data';
import { skillApi } from '@/api/endpoints';
import { normalizeSlugInput, slugError, slugify } from '@/lib/slug';
import { PromptEditor } from '../CreatePrompt/PromptEditor';
import type { SkillMeta, SkillParseResult } from './types';

const COMMON_TAGS = ['typescript', 'react', 'cli', 'lint', 'codegen', 'mock'] as const;
const MAX_TAGS = 8;
const MAX_TAG_LEN = 24;
const MAX_DESC_LEN = 80;

const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
// 允许小写字母、数字与中文(CJK)开头,内部可含 . + - 与中文。
const TAG_RE = /^[a-z0-9一-鿿][a-z0-9.+一-鿿-]*$/;

interface FieldErrors {
  name?: string;
  slug?: string;
  version?: string;
  description?: string;
  category?: string;
  tags?: string;
}

function validate(meta: SkillMeta): FieldErrors {
  const e: FieldErrors = {};
  if (!meta.name.trim()) e.name = '请输入 Skill 名称';
  else if (meta.name.length > 128) e.name = '名称最长 128 字符';

  const slugErr = slugError(meta.slug);
  if (slugErr) e.slug = slugErr;

  if (!meta.version.trim()) e.version = '请输入版本号';
  else if (!SEMVER_RE.test(meta.version)) e.version = '需符合 SemVer,如 0.1.0';

  if (!meta.description.trim()) e.description = '请填写一句话描述';
  else if (meta.description.length > MAX_DESC_LEN) e.description = `不超过 ${MAX_DESC_LEN} 字符`;

  if (!meta.category) e.category = '请选择分类';
  if (meta.tags.length > MAX_TAGS) e.tags = `最多 ${MAX_TAGS} 个标签`;
  return e;
}

export interface Step3Props {
  meta: SkillMeta;
  setMeta: Dispatch<SetStateAction<SkillMeta>>;
  parseResult?: SkillParseResult | null;
  onNext: () => void;
  onBack: () => void;
}

const VALID_CATS = new Set(['dev', 'data', 'design', 'doc', 'devops', 'ai']);

export function Step3Meta({ meta, setMeta, parseResult, onNext, onBack }: Step3Props) {
  const [tagError, setTagError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const { data: apiCats } = useCategories();
  const prefilledRef = useRef(false);

  const cats = useMemo(
    () =>
      (apiCats && apiCats.length > 0
        ? apiCats.map((c) => ({ id: String(c.id), name: c.name }))
        : CATEGORIES.map((c) => ({ id: c.id, name: c.name }))
      ).filter((c) => c.id !== 'all'),
    [apiCats]
  );

  // 仅在首次进入 Step3 时,把解析出的 frontmatter 字段填到空字段(不覆盖用户已输入的)
  useEffect(() => {
    if (prefilledRef.current) return;
    if (!parseResult || !parseResult.parsed) return;
    const p = parseResult.parsed;
    let next = { ...meta };
    let changed = false;
    if (!next.name && p.name) {
      next.name = p.name;
      changed = true;
    }
    // slug 默认按 name kebab 化(不覆盖用户已输入)
    if (!next.slug && p.name) {
      const candidate = slugify(p.name);
      if (candidate) {
        next.slug = candidate;
        changed = true;
      }
    }
    if (!next.version && p.version) {
      next.version = p.version;
      changed = true;
    }
    if (!next.description && p.description) {
      next.description = p.description.slice(0, 80);
      changed = true;
    }
    if (!next.category && p.category && VALID_CATS.has(p.category)) {
      next.category = p.category;
      changed = true;
    }
    if (next.tags.length === 0 && p.tags && p.tags.length > 0) {
      next.tags = p.tags.slice(0, 8);
      changed = true;
    }
    if (changed) setMeta(next);
    prefilledRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parseResult]);

  // 没选分类时给个合理默认（解析没填,且 API 返回时）
  // 用函数式 updater 读取最新 state，避免与预填 effect 在同批次更新时互相覆盖
  useEffect(() => {
    if (cats.length > 0) {
      setMeta(prev => (!prev.category ? { ...prev, category: cats[0].id } : prev));
    }
  }, [cats]);

  const errors = validate(meta);
  const hasError = Object.keys(errors).length > 0;

  // 必须用函数式更新：编辑器 onChange 是异步触发的，若用闭包里的 meta 会用旧快照覆盖掉刚预填的字段。
  const set = <K extends keyof SkillMeta>(k: K, v: SkillMeta[K]) =>
    setMeta((prev) => ({ ...prev, [k]: v }));

  const validateTag = (t: string): string | null => {
    if (!TAG_RE.test(t)) return '标签需以小写字母、数字或中文开头,仅含小写字母、数字、中文与 . + -';
    return null;
  };
  const addSuggested = (s: string) => {
    if (meta.tags.includes(s)) return;
    if (meta.tags.length >= MAX_TAGS) {
      setTagError(`最多 ${MAX_TAGS} 个标签`);
      return;
    }
    setTagError(null);
    set('tags', [...meta.tags, s]);
  };

  const tryNext = () => {
    setTouched(true);
    if (!hasError) onNext();
  };

  const showErr = (k: keyof FieldErrors) => (touched ? errors[k] : undefined);

  return (
    <div>
      <SectionHeader
        title="确认元数据"
        hint={
          parseResult?.hasFrontmatter
            ? '字段已从 SKILL.md frontmatter 自动填充,可手动调整'
            : '请确认或补充以下字段,审核与发布均依据这里的内容'
        }
      />

      <FormField label="图标" hint="可选 · 不上传则用分类图 / 名称首字母">
        <IconUpload
          currentUrl={meta.iconUrl}
          size={64}
          fallback={<SkillIcon ch={meta.name.slice(0, 1).toUpperCase() || 'S'} cat={meta.category} size={64} />}
          upload={async (file) => skillApi.uploadIcon(file)}
          onChange={(key, url) =>
            setMeta((prev) => ({ ...prev, iconKey: key ?? undefined, iconUrl: url ?? undefined }))
          }
        />
      </FormField>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <FormField label="名称" required hint={showErr('name')}>
          <Input
            value={meta.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="例如 graphql-codegen"
            maxLength={128}
          />
        </FormField>
        <FormField
          label="slug · 安装路径"
          required
          hint={showErr('slug') ?? `安装命令: smskill install ${meta.slug || 'your-slug'}`}
        >
          <PrefixInput
            prefix={`${meta.team || 'team'} /`}
            value={meta.slug}
            onChange={(v) => set('slug', normalizeSlugInput(v))}
            state={showErr('slug') ? 'error' : 'default'}
            placeholder="my-skill"
          />
        </FormField>
      </div>

      <FormField label="一句话描述" required hint={showErr('description')}>
        <Input
          value={meta.description}
          onChange={(e) => set('description', e.target.value)}
          maxLength={MAX_DESC_LEN}
          placeholder="一句话说清楚这个 skill 做什么"
        />
        <div
          style={{
            fontSize: 11,
            color: meta.description.length > MAX_DESC_LEN ? TOKENS.danger : TOKENS.text3,
            marginTop: 4,
          }}
        >
          {meta.description.length} / {MAX_DESC_LEN}
        </div>
      </FormField>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <FormField label="分类" required hint={showErr('category')}>
          <Select
            value={meta.category}
            onChange={(e) => set('category', e.target.value)}
            placeholder="请选择分类"
            options={cats.map((c) => ({ value: c.id, label: c.name }))}
          />
        </FormField>
        <FormField label="版本" required hint={showErr('version') ?? 'SemVer,如 0.1.0'}>
          <Input
            value={meta.version}
            onChange={(e) => set('version', e.target.value)}
            placeholder="0.1.0"
            style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}
          />
        </FormField>
      </div>

      <FormField
        label="标签"
        hint={tagError ?? `回车 / 逗号 / 空格 加入,最多 ${MAX_TAGS} 个 · 用于 Skills 广场检索`}
      >
        <TagsInput
          value={meta.tags}
          onChange={(next) => set('tags', next)}
          maxTags={MAX_TAGS}
          maxTagLength={MAX_TAG_LEN}
          placeholder="输入标签后回车"
          validate={validateTag}
          state={tagError ? 'error' : 'default'}
          onError={setTagError}
          ariaLabel="标签"
        />
        <div style={{ marginTop: 8, fontSize: 11, color: TOKENS.text3 }}>
          常用:{' '}
          {COMMON_TAGS.map((s) => {
            const disabled = meta.tags.includes(s) || meta.tags.length >= MAX_TAGS;
            return (
              <Button variant="ghost"
                key={s}
                type="button"
                onClick={() => addSuggested(s)}
                disabled={disabled}
                style={{
                  background: 'none',
                  border: 0,
                  color: disabled ? TOKENS.text3 : TOKENS.primary,
                  fontSize: 11,
                  cursor: disabled ? 'default' : 'pointer',
                  padding: '0 4px',
                }}
              >
                + {s}
              </Button>
            );
          })}
        </div>
      </FormField>

      <FormField
        label="详细介绍"
        hint="支持 Markdown 与图片（可粘贴 / 拖拽 / 点工具栏上传）· 展示在 Skill 详情页"
      >
        <PromptEditor
          value={meta.descriptionMd}
          onChange={(md) => set('descriptionMd', md)}
          placeholder="介绍这个 Skill 的用途、用法、示例、注意事项……"
          enableMentions={false}
          enableImages
          onImageUpload={async (file) => (await skillApi.uploadDescriptionImage(file)).url}
        />
      </FormField>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Button variant="ghost" size="md" onClick={onBack}>
          ← 返回
        </Button>
        <span style={{ flex: 1 }} />
        <Button
          variant="primary"
          size="md"
          onClick={tryNext}
          disabled={touched && hasError}
          icon={<I.chevR size={12} />}
        >
          下一步 · 可见性
        </Button>
      </div>
    </div>
  );
}
