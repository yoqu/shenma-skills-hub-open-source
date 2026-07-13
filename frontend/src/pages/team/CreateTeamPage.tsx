import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { Button, FormError, FormField, Input } from '@/components/ui';
import { TopBar } from '@/components/chrome';
import { getToken } from '@/api/client';
import { teamApi } from '@/api/endpoints';
import { useCurrentTeamStore } from '@/store/currentTeam';
import { normalizeSlugInput, slugError, slugify } from '@/lib/slug';

export default function CreateTeamPage() {
  if (!getToken()) return <Navigate to="/login" replace />;

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setCurrentTeamId = useCurrentTeamStore((s) => s.setCurrentTeamId);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const slugIssue = slugError(slug);

  async function handleCreate() {
    if (trimmed.length < 2) {
      setError('团队名称至少 2 个字符');
      return;
    }
    if (slugIssue) {
      setError(slugIssue);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const created = await teamApi.create(trimmed, slug);
      // 先刷新团队列表，确保新团队已进入 myTeams，再切换当前团队。
      // 否则挂载中的 TopBar(useCurrentTeam) 会因列表里还没有新团队而触发
      // 自动回退，把当前团队重置回 teams[0]（老团队）。
      await queryClient.refetchQueries({ queryKey: ['session', 'me'] });
      setCurrentTeamId(String(created.id));
      navigate('/team');
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: TOKENS.bgAlt, minHeight: '100%' }}>
      <TopBar authed />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 52px)',
          padding: '48px 24px',
        }}
      >
        <img
          src="/team/onboarding/create-team.png"
          alt=""
          aria-hidden="true"
          width={128}
          height={128}
          style={{ width: 128, height: 128, objectFit: 'contain', marginBottom: 10 }}
        />

        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: TOKENS.text,
            margin: '0 0 8px',
            textAlign: 'center',
          }}
        >
          创建新团队
        </h1>
        <p
          style={{
            fontSize: 14,
            color: TOKENS.text2,
            margin: '0 0 32px',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          你将成为团队的 Owner，可以邀请成员一起管理技能库
        </p>

        <div
          style={{
            background: '#fff',
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 12,
            padding: '28px 24px',
            width: '100%',
            maxWidth: 400,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <FormField label="团队名称">
            <Input
              value={name}
              onChange={(e) => {
                const nextName = e.target.value;
                setName(nextName);
                if (!slugEdited) setSlug(slugify(nextName, 64));
                setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="例：Frontend Guild"
              maxLength={64}
              autoFocus
              state={error ? 'error' : 'default'}
              style={{ height: 36 }}
            />
          </FormField>

          <FormField
            label="团队英文标识"
            hint={`团队 URL: /teams/${slug || 'your-team'}`}
            error={slugIssue && slugEdited ? slugIssue : undefined}
          >
            <Input
              value={slug}
              onChange={(e) => {
                setSlug(normalizeSlugInput(e.target.value).slice(0, 64));
                setSlugEdited(true);
                setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="frontend-guild"
              maxLength={64}
              state={slugIssue && slugEdited ? 'error' : 'default'}
              style={{
                height: 36,
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              }}
            />
          </FormField>

          <FormError message={error} />

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Button
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              onClick={() => navigate(-1)}
              disabled={loading}
            >
              取消
            </Button>
            <Button
              variant="primary"
              size="sm"
              style={{ flex: 2 }}
              onClick={handleCreate}
              disabled={loading || trimmed.length < 2 || !!slugIssue}
            >
              {loading ? '创建中…' : '创建团队'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
