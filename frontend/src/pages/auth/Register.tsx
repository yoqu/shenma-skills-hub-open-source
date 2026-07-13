import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import { Button } from '@/components/ui';
import { I } from '@/components/icons';
import { TopBar } from '@/components/chrome';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { StepIndicator } from './StepIndicator';
import { Step1Basic } from './Register/Step1';
import { Step2Verify } from './Register/Step2';
import { Step3Profile } from './Register/Step3';
import { Step4Done } from './Register/Step4';
import { RegisterIllustration } from './Register/Illustration';
import { AVATAR_COLORS, type RegisterState } from './Register/types';
import { ApiError, setToken } from '@/api/client';
import { authApi } from '@/api/endpoints';

type Step = 1 | 2 | 3 | 4;

const INITIAL: RegisterState = {
  phone: '',
  inviteCode: '',
  joinMode: 'none',
  agree: false,
  code: ['', '', '', '', '', ''],
  name: '',
  handle: '',
  email: '',
  password: '',
  passwordConfirm: '',
  avatarColor: AVATAR_COLORS[0],
};

export default function Register() {
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<RegisterState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [regToken, setRegToken] = useState('');
  const [error, setError] = useState('');

  // 已注册手机号 → 引导用户回到登录页的确认弹窗
  const [alreadyRegistered, setAlreadyRegistered] = useState('');

  function update(patch: Partial<RegisterState>) {
    setState((s) => ({ ...s, ...patch }));
  }

  async function requestRegisterCode(phoneOverride?: string) {
    const phone = phoneOverride ?? state.phone;
    if (phone.length !== 11) {
      setError('请输入 11 位手机号');
      return;
    }
    setSendingCode(true);
    setError('');
    try {
      await authApi.smsCode(phone, 'register');
      setRegToken('');
      update({ code: ['', '', '', '', '', ''] });
      setStep(2);
    } catch (e) {
      // 后端约定：40020 代表手机号已注册。提示用户切到登录流程，避免在注册页空转。
      if (e instanceof ApiError && e.code === 40020) {
        setAlreadyRegistered(phone);
        return;
      }
      setError(e instanceof Error ? e.message : '验证码发送失败');
    } finally {
      setSendingCode(false);
    }
  }

  // 从登录页跳转过来时，可携带 ?phone=xxx&autoSend=1，自动填入并续发注册验证码，
  // 避免用户再点一次「获取验证码」。autoSend 只触发一次，触发后从地址栏清掉，
  // 防止刷新或回退反复发码。
  const autoSentRef = useRef(false);
  useEffect(() => {
    if (autoSentRef.current) return;
    const queryPhone = searchParams.get('phone') || '';
    const autoSend = searchParams.get('autoSend') === '1';
    if (!/^1[3-9]\d{9}$/.test(queryPhone)) return;
    update({ phone: queryPhone });
    if (!autoSend) return;
    autoSentRef.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete('phone');
    next.delete('autoSend');
    setSearchParams(next, { replace: true });
    requestRegisterCode(queryPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verifyRegisterCode() {
    const phone = state.phone;
    const smsCode = state.code.join('');
    if (!/^\d{6}$/.test(smsCode)) {
      setError('请输入 6 位验证码');
      return;
    }
    setVerifyingCode(true);
    setError('');
    try {
      const step1 = await authApi.registerStep1({ phone, smsCode });
      setRegToken(step1.regToken);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : '验证码校验失败');
    } finally {
      setVerifyingCode(false);
    }
  }

  async function createAccount() {
    if (!regToken) {
      setError('请先完成手机号验证');
      setStep(2);
      return;
    }
    if (state.password.length < 6) {
      setError('密码至少 6 位');
      return;
    }
    if (state.password !== state.passwordConfirm) {
      setError('两次输入的密码不一致');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) {
        setError('请输入有效的邮箱地址');
        setSubmitting(false);
        return;
      }
      const step2 = await authApi.registerStep2({
        regToken,
        handle: state.handle,
        name: state.name,
        email: state.email.trim().toLowerCase(),
        password: state.password,
      });
      const step3 = await authApi.registerStep3({
        regToken: step2.regToken,
        avatar: state.name.slice(0, 1),
      });
      const done = await authApi.registerStep4({
        regToken: step3.regToken,
        inviteCode: state.joinMode === 'invite' ? state.inviteCode : undefined,
      });
      setToken(done.token);
      setSubmitting(false);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : '注册失败');
      setSubmitting(false);
    }
  }

  const titles: Record<Step, string> = {
    1: '创建你的账号',
    2: '输入验证码',
    3: '完善个人资料',
    4: '欢迎加入',
  };
  const subtitles: Record<Step, ReactNode> = {
    1: '填写手机号即可创建账号，如有团队邀请码可在注册时加入团队。',
    2: (
      <>
        已向 <b style={{ color: TOKENS.text2 }}>{state.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3')}</b> 发送 6 位验证码,有效期 5 分钟。
      </>
    ),
    3: '这些信息会出现在你的个人主页与 Skill 提交记录中,可稍后在设置里修改。',
    4: '账号已创建。下面是一些可以立刻上手的事。',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
          background: `radial-gradient(circle at 70% 20%, #F5F3FF, ${TOKENS.bgAlt} 60%)`,
          display: 'flex',
        }}
      >
        <div
          className="auth-panel"
          style={{
            flex: '0 1 520px',
            maxWidth: 520,
            width: '100%',
            padding: '56px 56px 48px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 40,
            }}
          >
            <BrandLogo iconSize={40} labelSize={17} />
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 12.5,
                color: TOKENS.text3,
              }}
            >
              已有账号?{' '}
              <a
                href="/login"
                onClick={(e) => {
                  e.preventDefault();
                  nav('/login');
                }}
                style={{ color: TOKENS.primary, fontWeight: 500 }}
              >
                去登录
              </a>
            </span>
          </div>

          <StepIndicator steps={['基础信息', '验证手机', '完善资料', '完成']} step={step} />

          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: -0.6,
              margin: '0 0 8px',
            }}
          >
            {titles[step]}
          </h1>
          <p
            style={{
              fontSize: 13.5,
              color: TOKENS.text3,
              margin: '0 0 24px',
              lineHeight: 1.6,
            }}
          >
            {subtitles[step]}
          </p>

          {step === 1 && <OAuthButtons onError={setError} />}

          {step !== 4 && (
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (step === 1) requestRegisterCode();
                else if (step === 2) verifyRegisterCode();
                else if (step === 3) createAccount();
              }}
              noValidate
            >
              {step === 1 && (
                <Step1Basic
                  state={state}
                  update={update}
                  submitting={sendingCode}
                />
              )}
              {step === 2 && (
                <Step2Verify
                  state={state}
                  update={update}
                  submitting={verifyingCode}
                  onBack={() => {
                    setRegToken('');
                    setStep(1);
                    update({ code: ['', '', '', '', '', ''] });
                  }}
                  onNext={verifyRegisterCode}
                />
              )}
              {step === 3 && (
                <Step3Profile
                  state={state}
                  update={update}
                  submitting={submitting}
                  onBack={() => setStep(2)}
                />
              )}
            </form>
          )}
          {step === 4 && <Step4Done state={state} onGo={() => nav('/team')} />}

          {error && (
            <div
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

          <div
            style={{
              marginTop: 'auto',
              paddingTop: 32,
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
          <RegisterIllustration step={step} />
        </div>
      </div>

      {alreadyRegistered && (
        <AlreadyRegisteredDialog
          phone={alreadyRegistered}
          onConfirm={() => {
            setAlreadyRegistered('');
            nav(`/login?phone=${encodeURIComponent(alreadyRegistered)}`);
          }}
          onCancel={() => setAlreadyRegistered('')}
        />
      )}
    </div>
  );
}

interface AlreadyRegisteredDialogProps {
  phone: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function AlreadyRegisteredDialog({ phone, onConfirm, onCancel }: AlreadyRegisteredDialogProps) {
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
      aria-label="手机号已注册"
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
            该手机号已注册
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: TOKENS.text2 }}>
          手机号 <b style={{ color: TOKENS.text }}>{masked}</b> 已存在账号。
          可直接前往登录页使用验证码或密码登录。
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Button type="button" variant="secondary" size="md" onClick={onCancel}>
            换个手机号
          </Button>
          <div style={{ flex: 1 }} />
          <Button type="button" variant="primary" size="md" onClick={onConfirm}>
            去登录
          </Button>
        </div>
      </div>
    </div>
  );
}
