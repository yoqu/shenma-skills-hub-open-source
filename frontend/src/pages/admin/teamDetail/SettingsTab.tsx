import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { TOKENS } from '@/lib/tokens';
import { Button, Card, Input, Select, toast } from '@/components/ui';
import { useUpdateAdminTeam } from '@/api/admin';
import type { AdminTeamDetail } from '@/api/endpoints';

interface Props {
  detail: AdminTeamDetail;
}

/** 团队自治字段后端尚未在 admin VO 暴露，前端兜底成 undefined / "—"。 */
type LooseDetail = AdminTeamDetail & {
  reviewMode?: 'AUTO' | 'REVIEW' | string | null;
  publicHome?: boolean | null;
  color?: string | null;
};

const SLUG_RE = /^[a-z0-9-]{2,40}$/;

export function SettingsTab({ detail }: Props) {
  const [name, setName] = useState(detail.name ?? '');
  const [slug, setSlug] = useState(detail.slug ?? '');
  const [status, setStatus] = useState<'ACTIVE' | 'DISABLED'>(
    detail.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
  );

  useEffect(() => {
    setName(detail.name ?? '');
    setSlug(detail.slug ?? '');
    setStatus(detail.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE');
  }, [detail.id, detail.name, detail.slug, detail.status]);

  const update = useUpdateAdminTeam();
  const d = detail as LooseDetail;

  const nameValid = name.trim().length >= 1 && name.trim().length <= 60;
  const slugValid = SLUG_RE.test(slug.trim());
  const dirty =
    name.trim() !== (detail.name ?? '') ||
    slug.trim() !== (detail.slug ?? '') ||
    status !== (detail.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE');

  const onSubmit = () => {
    if (!nameValid || !slugValid) return;
    const body: { name?: string; slug?: string; status?: 'ACTIVE' | 'DISABLED' } = {};
    if (name.trim() !== detail.name) body.name = name.trim();
    if (slug.trim() !== detail.slug) body.slug = slug.trim();
    if (status !== (detail.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE')) body.status = status;
    if (Object.keys(body).length === 0) return;
    update.mutate(
      { id: detail.id, body },
      {
        onSuccess: () => toast({ kind: 'success', message: '已保存' }),
        onError: (e) => toast({ kind: 'error', message: e instanceof Error ? e.message : '保存失败' }),
      },
    );
  };

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      <Card pad={16}>
        <div style={{ fontSize: 12, color: TOKENS.text3, marginBottom: 10 }}>平台可改字段</div>
        <Field label="名称">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          {!nameValid && <Hint danger>长度需在 1-60 之间</Hint>}
        </Field>
        <Field label="Slug">
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          {!slugValid && <Hint danger>仅小写字母 / 数字 / -，长度 2-40</Hint>}
        </Field>
        <Field label="状态">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'DISABLED')}
            style={{ width: 160, height: 34, padding: '0 30px 0 10px', fontSize: 13 }}
            options={[
              { value: 'ACTIVE', label: '正常' },
              { value: 'DISABLED', label: '已禁用' },
            ]}
          />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <Button
            variant="primary"
            size="sm"
            disabled={!dirty || !nameValid || !slugValid || update.isPending}
            onClick={onSubmit}
          >
            保存
          </Button>
        </div>
      </Card>

      <Card pad={16}>
        <div style={{ fontSize: 12, color: TOKENS.text3, marginBottom: 10 }}>
          团队自治字段（只读，团队 Owner / Admin 自行维护）
        </div>
        <ReadKV
          k="审核模式"
          v={d.reviewMode == null ? '—' : d.reviewMode === 'AUTO' ? '自动通过' : '需要审核'}
        />
        <ReadKV k="公开首页" v={d.publicHome == null ? '—' : d.publicHome ? '是' : '否'} />
        <ReadKV k="描述" v={detail.description || '—'} />
        <ReadKV k="Logo URL" v={detail.logoUrl || '—'} />
        <ReadKV k="主色" v={d.color || '—'} />
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: TOKENS.text3, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

function Hint({ children, danger }: { children: ReactNode; danger?: boolean }) {
  return (
    <div style={{ fontSize: 11.5, color: danger ? TOKENS.danger : TOKENS.text3, marginTop: 4 }}>
      {children}
    </div>
  );
}

function ReadKV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', fontSize: 13 }}>
      <div style={{ width: 80, color: TOKENS.text3 }}>{k}</div>
      <div style={{ flex: 1, color: TOKENS.text, wordBreak: 'break-all' }}>{v}</div>
    </div>
  );
}
