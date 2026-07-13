import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import {
  Button,
  Input,
} from '@/components/ui';

import { TopBar } from '@/components/chrome';
import { I } from '@/components/icons';
import { getToken } from '@/api/client';
import { teamApi } from '@/api/endpoints';
import { useMyPhoneInvites } from '@/api/data';

export default function NoTeamPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: pendingInvites = [] } = useMyPhoneInvites();

  const accept = useMutation({
    mutationFn: ({ teamId, id }: { teamId: number; id: number }) =>
      teamApi.invites.acceptPhone(teamId, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      navigate('/team');
    },
  });

  async function handleJoin() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await teamApi.joinByCode(code.trim());
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      navigate('/team');
    } catch {
      setError('邀请码无效或已过期，请确认后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: TOKENS.bgAlt, minHeight: '100%' }}>
      <TopBar authed={!!getToken()} />

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
          你还没有加入任何团队
        </h1>
        <p
          style={{
            fontSize: 14,
            color: TOKENS.text2,
            margin: '0 0 40px',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          创建一个新团队，或使用邀请码加入已有团队
        </p>

        {pendingInvites.length > 0 && (
          <div
            style={{
              width: '100%',
              maxWidth: 560,
              marginBottom: 20,
              background: TOKENS.primarySoft,
              border: `1px solid ${TOKENS.primary}30`,
              borderRadius: 12,
              padding: '16px 20px',
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: TOKENS.primary,
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <I.bell size={14} />
              你有 {pendingInvites.length} 个待响应的定向邀请
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingInvites.map((inv) => (
                <div
                  key={inv.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#fff',
                    borderRadius: 8,
                    padding: '10px 14px',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text }}>
                      {inv.teamName}
                    </div>
                    <div style={{ fontSize: 12, color: TOKENS.text3, marginTop: 2 }}>
                      {inv.invitedBy} 邀请 · {inv.at}
                      {inv.note && <span> · {inv.note}</span>}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={accept.isPending}
                    onClick={() => accept.mutate({ teamId: inv.teamId, id: inv.id })}
                  >
                    加入
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            width: '100%',
            maxWidth: 560,
          }}
        >
          <div
            style={{
              background: '#fff',
              border: `1px solid ${TOKENS.border}`,
              borderRadius: 12,
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <img
              src="/team/onboarding/create-team.png"
              alt=""
              aria-hidden="true"
              width={54}
              height={54}
              style={{ width: 54, height: 54, objectFit: 'contain' }}
            />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.text, marginBottom: 4 }}>
                创建新团队
              </div>
              <div style={{ fontSize: 13, color: TOKENS.text3, lineHeight: 1.5 }}>
                建立属于你们的技能库，邀请成员一起维护
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              style={{ marginTop: 4 }}
              onClick={() => navigate('/team/create')}
            >
              创建团队
            </Button>
          </div>

          <div
            style={{
              background: '#fff',
              border: `1px solid ${TOKENS.border}`,
              borderRadius: 12,
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <img
              src="/team/onboarding/join-team.png"
              alt=""
              aria-hidden="true"
              width={54}
              height={54}
              style={{ width: 54, height: 54, objectFit: 'contain' }}
            />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.text, marginBottom: 4 }}>
                通过邀请码加入
              </div>
              <div style={{ fontSize: 13, color: TOKENS.text3, lineHeight: 1.5 }}>
                输入团队管理员提供的邀请码
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Input
                value={code}
                onChange={(e) => { setCode(e.target.value); setError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="粘贴邀请码"
                state={error ? 'error' : 'default'}
                style={{
                  flex: 1,
                  height: 32,
                  padding: '0 10px',
                  fontSize: 13,
                  borderRadius: 6,
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleJoin}
                disabled={loading || !code.trim()}
              >
                {loading ? '…' : '加入'}
              </Button>
            </div>
            {error && (
              <div style={{ fontSize: 12, color: '#EF4444', marginTop: -4 }}>{error}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
