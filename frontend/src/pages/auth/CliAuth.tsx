import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Checkbox } from '@/components/ui';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { I } from '@/components/icons';
import { authApi } from '@/api/endpoints';
import { getToken } from '@/api/client';
import { TOKENS } from '@/lib/tokens';

type Phase = 'lookup' | 'confirm' | 'approving' | 'approved' | 'denied' | 'error';

const USER_CODE_RE = /^[A-HJ-NP-Z2-9]{4}-?[A-HJ-NP-Z2-9]{4}$/i;

function normalizeUserCode(raw: string | null): string {
  if (!raw) return '';
  const compact = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (compact.length !== 8) return raw.toUpperCase();
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

export default function CliAuth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const codeRaw = searchParams.get('code');
  const userCode = useMemo(() => normalizeUserCode(codeRaw), [codeRaw]);
  const validCode = USER_CODE_RE.test(userCode);

  const token = getToken();
  const [phase, setPhase] = useState<Phase>('lookup');
  const [error, setError] = useState('');
  const [remember, setRemember] = useState(false);

  // Redirect to login if not authenticated; preserve return-to.
  useEffect(() => {
    if (!token) {
      const ret = `/cli-auth?code=${encodeURIComponent(userCode)}`;
      navigate(`/login?next=${encodeURIComponent(ret)}`, { replace: true });
    }
  }, [token, userCode, navigate]);

  const lookup = useQuery({
    queryKey: ['cli-device', userCode],
    queryFn: () => authApi.cliDeviceLookup(userCode),
    enabled: !!token && validCode,
    retry: false,
  });

  const me = useQuery({
    queryKey: ['session', 'cli-auth-me'],
    queryFn: () => authApi.me(),
    enabled: !!token,
  });

  useEffect(() => {
    if (lookup.isSuccess) {
      setPhase('confirm');
    } else if (lookup.isError) {
      setPhase('error');
      const e = lookup.error as Error;
      setError(e?.message || '授权码无效或已过期');
    }
  }, [lookup.isSuccess, lookup.isError, lookup.error]);

  async function approve() {
    setPhase('approving');
    setError('');
    try {
      await authApi.cliDeviceApprove(userCode, remember);
      setPhase('approved');
    } catch (e) {
      setPhase('error');
      setError(e instanceof Error ? e.message : '授权失败');
    }
  }

  async function deny() {
    try {
      await authApi.cliDeviceDeny(userCode);
    } catch {
      // even on backend error, treat client side as denied so user knows.
    }
    setPhase('denied');
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: TOKENS.bgAlt,
        padding: 24,
      }}
    >
      <div
        style={{
          width: 'min(460px, 100%)',
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 10,
          background: '#fff',
          padding: 32,
          boxShadow: '0 18px 48px rgba(15, 23, 42, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          textAlign: 'center',
        }}
      >
        <BrandLogo iconSize={36} labelSize={15} />

        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background:
              phase === 'error' || phase === 'denied' ? '#FEF2F2' : TOKENS.primarySoft,
            color: phase === 'error' || phase === 'denied' ? TOKENS.danger : TOKENS.primary,
          }}
        >
          {phase === 'approved' ? (
            <I.check size={28} stroke={2.4} />
          ) : phase === 'error' || phase === 'denied' ? (
            <I.x size={28} stroke={2.4} />
          ) : (
            <I.terminal size={28} stroke={2.4} />
          )}
        </div>

        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: TOKENS.text }}>
            授权 CLI 设备
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: TOKENS.text2, lineHeight: 1.6 }}>
            {phase === 'approved'
              ? '已授权，可回到终端继续使用 smskill。'
              : phase === 'denied'
                ? '已拒绝。该授权码无法再被使用。'
                : phase === 'error'
                  ? error || '授权码无效或已过期'
                  : '确认是你本人在终端发起的登录请求？'}
          </p>
        </div>

        {!validCode && (
          <p style={{ margin: 0, fontSize: 12, color: TOKENS.danger }}>
            授权码格式不正确：{codeRaw || '(空)'}
          </p>
        )}

        {validCode && (phase === 'lookup' || phase === 'confirm' || phase === 'approving') && (
          <div
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 4,
              padding: '10px 18px',
              borderRadius: 8,
              background: TOKENS.bgGray,
              color: TOKENS.text,
            }}
          >
            {userCode}
          </div>
        )}

        {phase === 'confirm' && (
          <>
            <div style={{ fontSize: 12, color: TOKENS.text3, lineHeight: 1.6 }}>
              当前账号：<strong style={{ color: TOKENS.text }}>{me.data?.name || me.data?.handle || '...'}</strong>
              {' · '}
              <span>@{me.data?.handle || ''}</span>
              <br />
              {lookup.data?.userAgent && (
                <span style={{ color: TOKENS.text3 }}>
                  来源：{lookup.data.userAgent}
                </span>
              )}
              {lookup.data?.expiresIn != null && (
                <>
                  {lookup.data?.userAgent ? ' · ' : ''}
                  <span>有效期约 {Math.max(0, Math.round(lookup.data.expiresIn / 60))} 分钟</span>
                </>
              )}
            </div>

            <Checkbox
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              label="7 天免登录（CLI 长期 token）"
            />

            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <Button type="button" variant="ghost" onClick={deny} style={{ flex: 1 }}>
                拒绝
              </Button>
              <Button type="button" variant="primary" onClick={approve} style={{ flex: 1 }}>
                授权
              </Button>
            </div>
          </>
        )}

        {phase === 'approving' && (
          <p style={{ margin: 0, fontSize: 13, color: TOKENS.text2 }}>正在签发 token…</p>
        )}

        {(phase === 'approved' || phase === 'denied' || phase === 'error') && (
          <Button type="button" variant="ghost" onClick={() => navigate('/team', { replace: true })}>
            返回工作台
          </Button>
        )}
      </div>
    </div>
  );
}
