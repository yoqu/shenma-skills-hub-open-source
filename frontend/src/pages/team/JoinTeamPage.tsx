import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { Button, FormError, FormField, Input } from '@/components/ui';
import { TopBar } from '@/components/chrome';
import { getToken } from '@/api/client';
import { teamApi } from '@/api/endpoints';

export default function JoinTeamPage() {
  if (!getToken()) return <Navigate to="/login" replace />;

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(() => searchParams.get('code')?.toUpperCase() ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = code.trim();

  async function handleJoin() {
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      await teamApi.joinByCode(trimmed);
      await queryClient.invalidateQueries({ queryKey: ['session', 'me'] });
      navigate('/team');
    } catch {
      setError('邀请码无效或已过期，请确认后重试');
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
          src="/team/onboarding/join-team.png"
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
          通过邀请码加入团队
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
          输入团队管理员提供的邀请码，加入已有团队协作空间
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
          <FormField label="邀请码">
            <Input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="粘贴邀请码"
              autoFocus
              state={error ? 'error' : 'default'}
              style={{ height: 36 }}
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
              onClick={handleJoin}
              disabled={loading || !trimmed}
            >
              {loading ? '加入中…' : '加入团队'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
