import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LogIn } from 'lucide-react';
import { TOKENS } from '@/lib/tokens';
import { ApiError } from '@/api/client';
import { authApi, type PublicProviderVO } from '@/api/endpoints';

interface OAuthButtonsProps {
  /** 默认跳转目标，会被 URL 上的 ?next= 覆盖。 */
  fallbackNext?: string;
  /** 把跳转过程中的错误回传给页面统一展示。 */
  onError?: (message: string) => void;
}

/**
 * 第三方登录 / 注册按钮组。登录页与注册页共用：
 * 拉取已启用的 OAuth provider，点击后存好回跳目标并跳转到授权页。
 * 无可用 provider 时整体不渲染（含分隔线）。
 */
export function OAuthButtons({ fallbackNext = '/team', onError }: OAuthButtonsProps) {
  const [searchParams] = useSearchParams();
  const providersQuery = useQuery({
    queryKey: ['auth', 'providers'],
    queryFn: () => authApi.providers(),
    staleTime: 60_000,
    retry: false,
  });
  const providers: PublicProviderVO[] = [...(providersQuery.data ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const [submitting, setSubmitting] = useState<string | null>(null);

  if (providers.length === 0) return null;

  async function go(code: string) {
    if (submitting) return;
    setSubmitting(code);
    onError?.('');
    try {
      const next = searchParams.get('next') || fallbackNext;
      sessionStorage.setItem('skillstack.auth.next', next);
      const res = await authApi.oauthUrl(code);
      window.location.assign(res.authUrl);
    } catch (e) {
      if (e instanceof ApiError && (e.code === 40033 || e.code === 40034)) {
        onError?.('该登录方式暂不可用，请使用其他方式');
      } else {
        onError?.(e instanceof Error ? e.message : '登录跳转失败');
      }
      setSubmitting(null);
    }
  }

  return (
    <>
      <style>{`
        .oauth-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          height: 46px;
          padding: 0 16px;
          font-size: 14px;
          font-weight: 500;
          font-family: inherit;
          color: ${TOKENS.text};
          background: #fff;
          border: 1.5px solid ${TOKENS.border};
          border-radius: 12px;
          cursor: pointer;
          transition: border-color .15s ease, background .15s ease, box-shadow .15s ease, transform .1s ease;
        }
        .oauth-btn:hover:not(:disabled) {
          border-color: #C7D2FE;
          background: ${TOKENS.primarySoft};
          box-shadow: 0 2px 8px rgba(79,70,229,.08);
        }
        .oauth-btn:active:not(:disabled) { transform: translateY(1px); }
        .oauth-btn:disabled { cursor: default; }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {providers.map((p) => {
          const isSubmitting = submitting === p.code;
          const dimmed = submitting !== null && !isSubmitting;
          return (
            <button
              key={p.code}
              type="button"
              className="oauth-btn"
              onClick={() => go(p.code)}
              disabled={submitting !== null}
              style={dimmed ? { opacity: 0.5 } : undefined}
            >
              <span
                aria-hidden
                style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', flexShrink: 0 }}
              >
                {p.iconUrl ? (
                  <img src={p.iconUrl} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
                ) : (
                  <LogIn size={18} strokeWidth={2} style={{ color: TOKENS.primary }} />
                )}
              </span>
              {isSubmitting ? '正在跳转…' : `使用 ${p.buttonLabel || p.displayName} 登录`}
            </button>
          );
        })}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          margin: '18px 0 16px',
          color: TOKENS.text3,
          fontSize: 12,
        }}
      >
        <span style={{ flex: 1, height: 1, background: TOKENS.border }} />
        <span>或</span>
        <span style={{ flex: 1, height: 1, background: TOKENS.border }} />
      </div>
    </>
  );
}
