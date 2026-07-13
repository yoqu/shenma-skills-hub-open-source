import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { skillApi } from '@/api/endpoints';
import { useCategories, useCurrentTeam } from '@/api/data';
import { TOKENS } from '@/lib/tokens';
import { Button, IconUpload, Input, Select, SkillIcon, TagsInput, Textarea, toast } from '@/components/ui';
import { I } from '@/components/icons';
import type { Skill, Visibility } from '@/mocks/skills';

interface SkillEditDrawerProps {
  skill: Skill;
  onClose: () => void;
}

export function SkillEditDrawer({ skill, onClose }: SkillEditDrawerProps) {
  const { teamId } = useCurrentTeam();
  const qc = useQueryClient();
  const categories = useCategories();
  const [name, setName] = useState(skill.name);
  const [shortDesc, setShortDesc] = useState(skill.short);
  const [cat, setCat] = useState(skill.cat);
  const [icon, setIcon] = useState(skill.icon);
  const [iconKey, setIconKey] = useState<string | undefined>(undefined);
  const [iconUrl, setIconUrl] = useState<string | undefined>(skill.iconUrl);
  const [visibility, setVisibility] = useState<Visibility>(skill.visibility);
  const [tags, setTags] = useState<string[]>(skill.tags ?? []);
  const [tagError, setTagError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const mut = useMutation({
    mutationFn: () =>
      skillApi.updateAdminProfile(skill.id!, {
        name: name.trim(),
        shortDesc: shortDesc.trim(),
        cat,
        icon: icon.trim(),
        iconKey,
        visibility,
        tags,
      }),
    onSuccess: () => {
      toast({ kind: 'success', message: '已更新 Skill 信息' });
      qc.invalidateQueries({ queryKey: ['team-skills', teamId] });
      qc.invalidateQueries({ queryKey: ['skills', skill.slug] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : '保存失败'),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('名称不能为空');
    if (!shortDesc.trim()) return setError('描述不能为空');
    if (!cat) return setError('请选择分类');
    if (!skill.id) return setError('缺少 Skill ID，无法保存');
    setError(null);
    mut.mutate();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="skill-edit-title"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.36)', zIndex: 9000 }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          marginLeft: 'auto',
          width: 'min(520px, 100%)',
          height: '100%',
          background: '#fff',
          borderLeft: `1px solid ${TOKENS.border}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <form onSubmit={submit} style={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${TOKENS.borderSoft}`, display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div id="skill-edit-title" style={{ fontSize: 15, fontWeight: 650 }}>
                编辑 Skill 信息
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: TOKENS.text3 }}>
                v{skill.version} · {skill.status === 'UNLISTED' ? '已下架' : '已发布'}
              </div>
            </div>
            <Button variant="ghost" type="button" onClick={onClose} aria-label="关闭" style={iconBtnStyle}>
              <I.x size={16} />
            </Button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="名称">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </Field>
            <Field label="描述">
              <Textarea value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} maxLength={200} rows={4} />
            </Field>
            <Field label="分类">
              <Select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                style={selectStyle}
                options={
                  categories.isLoading
                    ? [{ value: cat, label: '加载中...' }]
                    : (categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))
                }
              />
            </Field>
            <Field label="图标图片（可选，不上传则用下方字符 / 分类图）">
              <IconUpload
                currentUrl={iconUrl}
                size={64}
                fallback={<SkillIcon ch={(icon || name).slice(0, 1).toUpperCase() || 'S'} cat={cat} size={64} />}
                upload={async (file) => skillApi.uploadIcon(file)}
                onChange={(key, url) => {
                  setIconKey(key ?? undefined);
                  setIconUrl(url ?? undefined);
                }}
              />
            </Field>
            <Field label="图标字符（兜底，仅未上传图片时使用）">
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={8} />
            </Field>
            <Field label="可见性">
              <div style={{ display: 'flex', gap: 8 }}>
                <Choice active={visibility === 'PUBLIC'} onClick={() => setVisibility('PUBLIC')}>公开</Choice>
                <Choice active={visibility === 'TEAM_PRIVATE'} onClick={() => setVisibility('TEAM_PRIVATE')}>团队私有</Choice>
              </div>
            </Field>
            <Field label="标签" hint={tagError ?? undefined}>
              <TagsInput
                value={tags}
                onChange={setTags}
                maxTags={8}
                maxTagLength={32}
                onError={setTagError}
                placeholder="输入标签后回车"
              />
            </Field>
            {error && <div style={{ color: TOKENS.danger, fontSize: 12 }}>{error}</div>}
          </div>

          <div style={{ padding: 16, borderTop: `1px solid ${TOKENS.borderSoft}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button type="button" variant="secondary" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? '保存中...' : '保存'}</Button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.text2 }}>{label}</span>
      {children}
      {hint && <span style={{ color: TOKENS.danger, fontSize: 11.5 }}>{hint}</span>}
    </label>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button variant="ghost" type="button" onClick={onClick} style={{ ...choiceStyle, borderColor: active ? TOKENS.primary : TOKENS.border, color: active ? TOKENS.primary : TOKENS.text2, background: active ? `${TOKENS.primary}12` : '#fff' }}>
      {children}
    </Button>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: TOKENS.text3,
  padding: 4,
};

const selectStyle: React.CSSProperties = {
  height: 38,
  padding: '0 30px 0 10px',
};

const choiceStyle: React.CSSProperties = {
  height: 34,
  padding: '0 12px',
  border: `1px solid ${TOKENS.border}`,
  borderRadius: 8,
  fontFamily: 'inherit',
  cursor: 'pointer',
};
