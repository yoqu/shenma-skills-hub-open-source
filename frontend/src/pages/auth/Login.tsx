import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import { Button, Checkbox, FormField, Input, OtpInput, PhoneInput } from '@/components/ui';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { I } from '@/components/icons';
import { TopBar } from '@/components/chrome';
import { ApiError, setToken } from '@/api/client';
import { authApi } from '@/api/endpoints';

type Method = 'code' | 'password';

export default function Login() {
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [method, setMethod] = useState<Method>('code');

  // 验证码登录
  const initialPhone = (() => {
    const q = searchParams.get('phone') || '';
    return /^1[3-9]\d{9}$/.test(q) ? q : '';
  })();
  const [phone, setPhone] = useState(initialPhone);
  const [phoneTouched, setPhoneTouched] = useState(false);

  useEffect(() => {
    if (!initialPhone) return;
    const next = new URLSearchParams(searchParams);
    next.delete('phone');
    setSearchParams(next, { replace: true });
    // 只在挂载时清理 query，不依赖后续 searchParams 变化。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [codeSent, setCodeSent] = useState(false);
  const [remember, setRemember] = useState(true);
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loggedInName, setLoggedInName] = useState('');

  const redirectTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (redirectTimerRef.current) window.clearTimeout(redirectTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (countdown <= 0) return;
    const id = window.setInterval(() => {
      setCountdown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [countdown]);

  // 密码登录
  const [pwdAccount, setPwdAccount] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwdRemember, setPwdRemember] = useState(true);
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 未注册手机号 → 引导用户进入注册流程的确认弹窗
  const [unregisteredPrompt, setUnregisteredPrompt] = useState<string>('');
  const [forwardingToRegister, setForwardingToRegister] = useState(false);

  async function sendCode() {
    if (sendingCode) return;
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入有效的中国大陆手机号');
      return;
    }
    setError('');
    setSendingCode(true);
    try {
      await authApi.smsCode(phone, 'login');
      setCode(['', '', '', '', '', '']);
      setCountdown(60);
      setCodeSent(true);
    } catch (e) {
      // 后端约定：40004 代表手机号未注册。命中后弹窗引导用户跳转到注册流程，
      // 注册页会自动续发一条 register 验证码，避免用户再点一次发送。
      if (e instanceof ApiError && e.code === 40004) {
        setUnregisteredPrompt(phone);
        return;
      }
      setError(e instanceof Error ? e.message : '验证码发送失败');
    } finally {
      setSendingCode(false);
    }
  }

  function gotoRegisterWithPhone() {
    if (forwardingToRegister) return;
    setForwardingToRegister(true);
    setUnregisteredPrompt('');
    nav(`/register?phone=${encodeURIComponent(phone)}&autoSend=1`);
  }

  async function login(smsCodeOverride?: string) {
    if (verifying) return;
    setError('');
    const smsCode = smsCodeOverride ?? code.join('');
    if (!/^\d{6}$/.test(smsCode)) {
      setError('请输入 6 位验证码');
      return;
    }
    setVerifying(true);
    try {
      const res = await authApi.login({ phone, smsCode, remember });
      setToken(res.token);
      setLoggedInName(res.user?.name || '');
      setLoggedIn(true);
      redirectTimerRef.current = window.setTimeout(() => nav('/team'), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败');
      setCode(['', '', '', '', '', '']);
    } finally {
      setVerifying(false);
    }
  }

  async function submitPassword() {
    if (pwdSubmitting) return;
    if (!pwdAccount.trim() || pwd.length < 6) return;
    setPwdSubmitting(true);
    setError('');
    try {
      const res = await authApi.login({
        identifier: pwdAccount.trim(),
        password: pwd,
        remember: pwdRemember,
      });
      setToken(res.token);
      nav('/team');
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败');
    } finally {
      setPwdSubmitting(false);
    }
  }

  function onCodeSubmit(e: FormEvent) {
    e.preventDefault();
    login();
  }

  function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    submitPassword();
  }

  const phoneValid = /^1[3-9]\d{9}$/.test(phone);
  const phoneError =
    phoneTouched && phone.length > 0 && !phoneValid
      ? '请输入有效的中国大陆手机号（以 1 开头的 11 位数字）'
      : undefined;
  const canSendCode = phoneValid && !sendingCode;
  const canResend = countdown <= 0 && !sendingCode;
  const codeComplete = code.every((c) => /^\d$/.test(c));
  const canLogin = codeComplete && !verifying;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* RESP-001: 手机端隐藏视觉区，登录面板自适应铺满 */}
      <style>{`
        @media (max-width: 768px) {
          .auth-page { flex-direction: column; }
          .auth-panel { flex: 1 1 auto !important; max-width: 100% !important; padding: 24px !important; }
          .auth-visual { display: none !important; }
        }
      `}</style>
      <TopBar authed={false} />
      <div
        className="auth-page"
        style={{
          flex: 1,
          background: `radial-gradient(circle at 30% 20%, #F5F3FF, ${TOKENS.bgAlt} 60%)`,
          display: 'flex',
        }}
      >
        <div
          className="auth-panel"
          style={{
            flex: '0 1 480px',
            maxWidth: 480,
            width: '100%',
            padding: '40px 56px 56px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
            <BrandLogo iconSize={40} labelSize={17} />
          </div>

          {/* 方式切换 tabs */}
          {!loggedIn && (
            <div
              style={{
                display: 'inline-flex',
                gap: 2,
                padding: 3,
                background: '#fff',
                border: `1px solid ${TOKENS.border}`,
                borderRadius: 10,
                alignSelf: 'flex-start',
                marginBottom: 18,
              }}
            >
              {(
                [
                  { k: 'code', label: '验证码登录' },
                  { k: 'password', label: '密码登录' },
                ] as { k: Method; label: string }[]
              ).map((m) => (
                <Button variant="ghost"
                  key={m.k}
                  type="button"
                  onClick={() => {
                    setMethod(m.k);
                    setError('');
                  }}
                  style={{
                    padding: '6px 14px',
                    fontSize: 12.5,
                    fontWeight: 500,
                    background: method === m.k ? TOKENS.primarySoft : 'transparent',
                    color: method === m.k ? TOKENS.primaryDeep : TOKENS.text2,
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          )}

          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: -0.6,
              margin: '0 0 8px',
            }}
          >
            {loggedIn ? '登录成功' : method === 'code' ? '欢迎回来' : '使用密码登录'}
          </h1>
          <p
            style={{
              fontSize: 14,
              color: TOKENS.text3,
              margin: '0 0 24px',
              lineHeight: 1.6,
            }}
          >
            {loggedIn && '正在跳转到团队工作台…'}
            {!loggedIn && method === 'code' && '使用手机号验证码登录。'}
            {!loggedIn && method === 'password' && '输入用户名 / 邮箱与密码完成登录。'}
          </p>

          {!loggedIn && <OAuthButtons onError={setError} />}

          {/* 验证码登录 form */}
          {method === 'code' && !loggedIn && (
            <form onSubmit={onCodeSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormField
                label={
                  <>
                    手机号
                    <span style={{ marginLeft: 6, fontSize: 11, color: TOKENS.text3, fontWeight: 400 }}>
                      · 用于接收登录验证码
                    </span>
                  </>
                }
                error={phoneError}
              >
                <div style={{ display: 'flex', gap: 8 }} onBlur={() => setPhoneTouched(true)}>
                  <div style={{ flex: 1 }}>
                    <PhoneInput
                      id="login-phone"
                      value={phone}
                      onChange={(v) => {
                        setPhone(v);
                        if (codeSent) {
                          setCodeSent(false);
                          setCode(['', '', '', '', '', '']);
                          setCountdown(0);
                        }
                      }}
                      state={phoneError ? 'error' : phoneValid ? 'success' : 'default'}
                    />
                  </div>
                  <Button variant="ghost"
                    type="button"
                    onClick={sendCode}
                    disabled={!canSendCode && !(codeSent && canResend)}
                    style={{
                      flexShrink: 0,
                      padding: '0 14px',
                      fontSize: 12.5,
                      fontWeight: 500,
                      background: (canSendCode || (codeSent && canResend)) ? TOKENS.primarySoft : TOKENS.bgAlt,
                      color: (canSendCode || (codeSent && canResend)) ? TOKENS.primaryDeep : TOKENS.text3,
                      border: `1px solid ${(canSendCode || (codeSent && canResend)) ? TOKENS.primary : TOKENS.border}`,
                      borderRadius: 12,
                      cursor: (canSendCode || (codeSent && canResend)) ? 'pointer' : 'default',
                      fontFamily: 'inherit',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sendingCode
                      ? '发送中…'
                      : codeSent
                        ? countdown > 0
                          ? `${countdown}s`
                          : '重新发送'
                        : '获取验证码'}
                  </Button>
                </div>
              </FormField>

              {codeSent && (
                <FormField label="验证码">
                  <OtpInput
                    value={code}
                    onChange={setCode}
                    onComplete={(v) => login(v)}
                    disabled={verifying}
                  />
                </FormField>
              )}

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12.5,
                  color: TOKENS.text2,
                  cursor: 'pointer',
                  userSelect: 'none',
                  marginTop: -2,
                }}
              >
                <Checkbox
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                7 天内免登录
                <span
                  className="auth-hint-secondary"
                  style={{ marginLeft: 'auto', fontSize: 11.5, color: TOKENS.text3 }}
                >
                  公共设备建议关闭
                </span>
              </label>

              <Button
                type="submit"
                variant={canLogin && codeSent ? 'primary' : 'secondary'}
                size="lg"
                full
                disabled={!canLogin || !codeSent}
                aria-disabled={!canLogin || !codeSent}
                style={{
                  borderRadius: 12,
                  ...(!canLogin || !codeSent ? { color: TOKENS.text3, cursor: 'not-allowed' } : {}),
                }}
              >
                {verifying ? '验证中…' : canLogin ? '登录' : codeSent ? '请输入 6 位验证码' : '请先获取验证码'}
              </Button>
            </form>
          )}

          {/* 登录成功 */}
          {method === 'code' && loggedIn && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                padding: '32px 0',
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: TOKENS.primarySoft,
                  color: TOKENS.primary,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <I.check size={32} stroke={2.5} />
              </div>
              <div style={{ fontSize: 14, color: TOKENS.text2 }}>
                {loggedInName ? (
                  <>
                    欢迎，<b style={{ color: TOKENS.text }}>{loggedInName}</b>
                  </>
                ) : (
                  '登录成功'
                )}
              </div>
            </div>
          )}

          {/* 密码登录 form */}
          {method === 'password' && (
            <form onSubmit={onPasswordSubmit} noValidate>
              <LoginPassword
                account={pwdAccount}
                setAccount={setPwdAccount}
                password={pwd}
                setPassword={setPwd}
                remember={pwdRemember}
                setRemember={setPwdRemember}
                submitting={pwdSubmitting}
              />
            </form>
          )}

          {error && (
            <div
              role="alert"
              style={{
                marginTop: 12,
                padding: '10px 12px',
                borderRadius: 8,
                background: '#FEF2F2',
                color: TOKENS.danger,
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          {!loggedIn && (
            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: `1px dashed ${TOKENS.border}`,
                fontSize: 12.5,
                color: TOKENS.text3,
                textAlign: 'center',
              }}
            >
              还没账号?{' '}
              <a
                href="/register"
                onClick={(e) => {
                  e.preventDefault();
                  nav('/register');
                }}
                style={{ color: TOKENS.primary, fontWeight: 500 }}
              >
                使用邀请码注册 →
              </a>
            </div>
          )}

          <div
            style={{
              marginTop: 'auto',
              paddingTop: 24,
              fontSize: 11.5,
              color: TOKENS.text3,
            }}
          >
            继续即表示你同意我们的
            <a href="/terms" style={{ color: TOKENS.text2 }}>
              服务条款
            </a>
            与
            <a href="/privacy" style={{ color: TOKENS.text2 }}>
              隐私政策
            </a>
            。
          </div>
        </div>

        <div className="auth-visual" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <LoginIllustration />
        </div>
      </div>

      {unregisteredPrompt && (
        <UnregisteredPhoneDialog
          phone={unregisteredPrompt}
          forwarding={forwardingToRegister}
          onConfirm={gotoRegisterWithPhone}
          onCancel={() => setUnregisteredPrompt('')}
        />
      )}
    </div>
  );
}

interface UnregisteredPhoneDialogProps {
  phone: string;
  forwarding: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function UnregisteredPhoneDialog({ phone, forwarding, onConfirm, onCancel }: UnregisteredPhoneDialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const masked = phone.replace(/(\d{3})\d{4}(\d{4})/, '$1 **** $2');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="手机号未注册"
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.45)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 100%)',
          background: '#fff',
          borderRadius: 14,
          padding: '24px 24px 20px',
          boxShadow: '0 24px 60px rgba(15,23,42,.18)',
          border: `1px solid ${TOKENS.borderSoft}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: TOKENS.primarySoft,
              color: TOKENS.primaryDeep,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <I.user size={18} stroke={2.2} />
          </div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: TOKENS.text }}>
            手机号尚未注册
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: TOKENS.text2 }}>
          手机号 <b style={{ color: TOKENS.text }}>{masked}</b> 还未注册账号。
          是否继续完成注册？我们会向该手机号下发新的注册验证码。
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Button type="button" variant="secondary" size="md" onClick={onCancel} disabled={forwarding}>
            换个手机号
          </Button>
          <div style={{ flex: 1 }} />
          <Button type="button" variant="primary" size="md" onClick={onConfirm} disabled={forwarding}>
            {forwarding ? '正在跳转…' : '立即注册'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------- 子组件 -------- */

interface PasswordProps {
  account: string;
  setAccount: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  remember: boolean;
  setRemember: (v: boolean) => void;
  submitting: boolean;
}

function LoginPassword({
  account,
  setAccount,
  password,
  setPassword,
  remember,
  setRemember,
  submitting,
}: PasswordProps) {
  const [show, setShow] = useState(false);
  const valid = account.trim().length > 0 && password.length >= 6;
  const canSubmit = valid && !submitting;
  const disabledStyle: CSSProperties = {
    borderRadius: 12,
    ...(!canSubmit ? { color: TOKENS.text3, cursor: 'not-allowed' } : {}),
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label
          htmlFor="login-account"
          style={{ fontSize: 12, fontWeight: 500, color: TOKENS.text2, display: 'block', marginBottom: 6 }}
        >
          用户名 / 邮箱
        </label>
        <Input
          id="login-account"
          name="username"
          autoComplete="username"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="例如 zhao_yc 或 zhao.yc@ludou.test"
          style={{
            padding: '12px 14px',
            fontSize: 14,
            border: `1.5px solid ${TOKENS.border}`,
            borderRadius: 12,
            color: TOKENS.text,
          }}
        />
      </div>

      <div>
        <label
          htmlFor="login-password"
          style={{ fontSize: 12, fontWeight: 500, color: TOKENS.text2, display: 'flex', marginBottom: 6 }}
        >
          密码
        </label>
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            border: `1.5px solid ${TOKENS.border}`,
            borderRadius: 12,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          <Input
            id="login-password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={show ? 'text' : 'password'}
            placeholder="至少 6 位"
            style={{
              flex: 1,
              width: 'auto',
              padding: '12px 14px',
              fontSize: 14,
              border: 'none',
              background: 'transparent',
              color: TOKENS.text,
              letterSpacing: show ? 0 : 2,
            }}
          />
          <Button variant="ghost"
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? '隐藏密码' : '显示密码'}
            style={{
              padding: '0 12px',
              fontSize: 11.5,
              fontWeight: 500,
              background: 'transparent',
              color: TOKENS.text3,
              border: 'none',
              borderLeft: `1px solid ${TOKENS.border}`,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {show ? '隐藏' : '显示'}
          </Button>
        </div>
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12.5,
          color: TOKENS.text2,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <Checkbox
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        7 天内免登录
      </label>

      <Button
        type="submit"
        variant={canSubmit ? 'primary' : 'secondary'}
        size="lg"
        full
        disabled={!canSubmit}
        aria-disabled={!canSubmit}
        style={disabledStyle}
      >
        {submitting ? '登录中…' : valid ? '登录' : '请填写完整信息'}
      </Button>
    </div>
  );
}

function LoginIllustration() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: '78%',
          aspectRatio: '1.2',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(79,70,229,.18), rgba(16,185,129,.08) 45%, transparent 72%)`,
          filter: 'blur(4px)',
          transform: 'translate(-2%, -2%)',
        }}
      />

      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '8% 9%',
          borderRadius: 32,
          border: `1px solid ${TOKENS.borderSoft}`,
          background: 'rgba(255,255,255,.36)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.75)',
        }}
      />

      <img
        src="/auth/login-illustration.png"
        alt="团队成员回到 神马 skill hub 工作台协作整理 Skill"
        style={{
          position: 'relative',
          zIndex: 1,
          width: 'min(740px, 94%)',
          height: 'auto',
          objectFit: 'contain',
          filter: 'drop-shadow(0 30px 36px rgba(79,70,229,.18))',
        }}
      />
    </div>
  );
}
