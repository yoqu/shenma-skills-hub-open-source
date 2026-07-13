import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { I } from '@/components/icons';
import { authApi } from '@/api/endpoints';
import { setToken } from '@/api/client';
import { TOKENS } from '@/lib/tokens';

interface AuthCallbackProps {
  fixedProvider?: string;
}

export default function AuthCallback({ fixedProvider }: AuthCallbackProps = {}) {
  const { provider: routeProvider } = useParams<{ provider?: string }>();
  const provider = fixedProvider ?? routeProvider ?? 'feishu';

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const processedRef = useRef(false);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('正在验证登录…');

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (!code || !state) {
      setStatus('error');
      setMessage('回调参数不完整，请重新登录');
      return;
    }

    authApi.oauthCallback(provider, code, state)
      .then((res) => {
        setToken(res.token);
        setStatus('success');
        setMessage('登录成功，正在进入工作台…');
        window.setTimeout(() => {
          const next = sessionStorage.getItem('skillstack.auth.next') || '/team';
          sessionStorage.removeItem('skillstack.auth.next');
          navigate(next, { replace: true });
        }, 700);
      })
      .catch((error) => {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : '登录验证失败');
      });
  }, [navigate, provider, searchParams]);

  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1).replace(/_/g, '.');

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
          width: 'min(420px, 100%)',
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 8,
          background: '#fff',
          padding: 28,
          boxShadow: '0 18px 48px rgba(15, 23, 42, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          textAlign: 'center',
        }}
      >
        <BrandLogo iconSize={38} labelSize={16} />
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: status === 'error' ? '#FEF2F2' : TOKENS.primarySoft,
            color: status === 'error' ? TOKENS.danger : TOKENS.primary,
          }}
        >
          {status === 'loading' ? (
            <span className="auth-callback-spinner" />
          ) : status === 'success' ? (
            <I.check size={28} stroke={2.4} />
          ) : (
            <I.x size={28} stroke={2.4} />
          )}
        </div>
        <style>{`
          .auth-callback-spinner {
            width: 26px;
            height: 26px;
            border: 3px solid ${TOKENS.primarySoft};
            border-top-color: ${TOKENS.primary};
            border-radius: 999px;
            animation: auth-callback-spin 0.85s linear infinite;
          }
          @keyframes auth-callback-spin { to { transform: rotate(360deg); } }
        `}</style>
        <div>
          <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: TOKENS.text }}>
            {status === 'error' ? `${providerLabel} 登录失败` : `${providerLabel} 登录`}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: TOKENS.text2, lineHeight: 1.6 }}>{message}</p>
        </div>
        {status === 'error' && (
          <Button type="button" variant="primary" onClick={() => navigate('/login', { replace: true })}>
            返回登录页
          </Button>
        )}
      </div>
    </div>
  );
}
