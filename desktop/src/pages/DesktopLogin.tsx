import { useEffect, useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { consumeLoginNotice, setToken, toSessionNotice } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { Button, FormError, Input, Spinner, toast, TOKENS } from '@skillstack/ui';
import {
  readDesktopSettings,
  saveDesktopSettings,
  testDesktopBackendConnection,
  type DesktopSettings,
} from './desktopBridge';

type LoginState = 'idle' | 'waiting' | 'done' | 'error';
type DraggableRegionStyle = React.CSSProperties & {
  WebkitAppRegion: 'drag';
};
type NoDragRegionStyle = React.CSSProperties & {
  WebkitAppRegion: 'no-drag';
};

export default function DesktopLogin() {
  const navigate = useNavigate();
  const [state, setState] = useState<LoginState>('idle');
  const [initialNotice] = useState(() => consumeLoginNotice() || '');
  const [apiSettingsOpen, setApiSettingsOpen] = useState(false);
  const [apiSettingsLoading, setApiSettingsLoading] = useState(false);
  const [apiSettingsSaving, setApiSettingsSaving] = useState(false);
  const [apiSettingsTesting, setApiSettingsTesting] = useState(false);
  const [apiSettingsError, setApiSettingsError] = useState('');
  const [apiBaseUrlDraft, setApiBaseUrlDraft] = useState('');
  const [desktopSettings, setDesktopSettings] = useState<DesktopSettings | null>(null);
  const apiSettingsRef = useRef<HTMLDivElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const cancelledRef = useRef(false);
  const initialNoticeRef = useRef(initialNotice);

  useEffect(() => {
    void window.skillstackDesktop?.setWindowMode('login');
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (initialNoticeRef.current) {
      toast({ kind: 'error', message: initialNoticeRef.current });
      initialNoticeRef.current = '';
    }
  }, []);

  useEffect(() => {
    if (!apiSettingsOpen) {
      return;
    }

    function closeOnOutsidePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (apiSettingsRef.current?.contains(target) || settingsButtonRef.current?.contains(target)) {
        return;
      }

      closeApiSettings();
    }

    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
  }, [apiSettingsOpen, apiSettingsSaving]);

  async function startLogin() {
    cancelledRef.current = false;
    setState('waiting');

    try {
      const init = await authApi.cliDeviceInit();
      if (cancelledRef.current) return;

      window.open(init.verificationUri, '_blank', 'noopener,noreferrer');

      const deadline = Date.now() + init.expiresIn * 1000;
      while (!cancelledRef.current && Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, Math.max(1, init.interval) * 1000));
        if (cancelledRef.current) return;

        const poll = await authApi.cliDevicePoll(init.deviceCode);
        if (cancelledRef.current) return;

        if (poll.status === 'approved' && poll.token) {
          setToken(poll.token);
          setState('done');
          toast({ kind: 'success', message: '登录成功，正在进入桌面端' });
          await window.skillstackDesktop?.setWindowMode('app');
          navigate('/', { replace: true });
          return;
        }
      }

      if (!cancelledRef.current) {
        setState('error');
        const msg = '登录授权已过期，请重新发起登录';
        toast({ kind: 'error', message: msg });
      }
    } catch (e) {
      if (!cancelledRef.current) {
        setState('error');
        const msg = toSessionNotice(e);
        toast({ kind: 'error', message: msg });
      }
    }
  }

  function cancelLogin() {
    cancelledRef.current = true;
    setState('idle');
  }

  async function openApiSettings() {
    setApiSettingsOpen(true);
    setApiSettingsError('');
    setApiSettingsLoading(true);

    try {
      const settings = await readDesktopSettings();
      setDesktopSettings(settings);
      setApiBaseUrlDraft(settings.apiBaseUrl);
    } catch (error) {
      const message = errorMessage(error, '设置读取失败');
      setApiSettingsError(message);
      toast({ kind: 'error', message });
    } finally {
      setApiSettingsLoading(false);
    }
  }

  function closeApiSettings() {
    if (apiSettingsSaving) {
      return;
    }

    setApiSettingsOpen(false);
    setApiSettingsError('');
  }

  async function testApiSettings() {
    const apiBaseUrl = apiBaseUrlDraft.trim();
    const validationError = validateApiBaseUrl(apiBaseUrl);
    if (validationError) {
      setApiSettingsError(validationError);
      return;
    }

    setApiSettingsTesting(true);
    setApiSettingsError('');

    try {
      await testDesktopBackendConnection(apiBaseUrl);
      toast({ kind: 'success', message: '服务连接正常' });
    } catch (error) {
      const message = errorMessage(error, '后端连接失败');
      setApiSettingsError(message);
      toast({ kind: 'error', message });
    } finally {
      setApiSettingsTesting(false);
    }
  }

  async function saveApiSettings() {
    const apiBaseUrl = apiBaseUrlDraft.trim();
    const validationError = validateApiBaseUrl(apiBaseUrl);
    if (validationError) {
      setApiSettingsError(validationError);
      return;
    }

    setApiSettingsSaving(true);
    setApiSettingsError('');

    try {
      const currentSettings = desktopSettings ?? await readDesktopSettings();
      const saved = await saveDesktopSettings({
        ...currentSettings,
        apiBaseUrl,
      });
      setDesktopSettings(saved);
      setApiBaseUrlDraft(saved.apiBaseUrl);
      setApiSettingsOpen(false);
      toast({ kind: 'success', message: '服务地址已保存' });
    } catch (error) {
      const message = errorMessage(error, '服务地址保存失败');
      setApiSettingsError(message);
      toast({ kind: 'error', message });
    } finally {
      setApiSettingsSaving(false);
    }
  }

  const isWaiting = state === 'waiting';
  const isDone = state === 'done';

  return (
    <div style={pageStyle}>
      <div style={dragRegionStyle} />
      <button
        ref={settingsButtonRef}
        type="button"
        aria-label="设置服务 API 地址"
        onClick={() => void openApiSettings()}
        style={settingsButtonStyle}
      >
        <Settings size={17} strokeWidth={2.1} />
      </button>
      {apiSettingsOpen && (
        <>
          <div style={apiSettingsClickAwayStyle} onPointerDown={closeApiSettings} />
          <div ref={apiSettingsRef} style={apiSettingsPopoverStyle}>
            <div style={apiSettingsHeaderStyle}>
              <div style={apiSettingsTitleStyle}>服务设置</div>
              <div style={apiSettingsHintStyle}>登录前可切换 SkillStack 服务地址</div>
            </div>
            <label htmlFor="loginApiBaseUrl" style={apiSettingsLabelStyle}>服务 API 地址</label>
            <Input
              id="loginApiBaseUrl"
              value={apiBaseUrlDraft}
              onChange={(event) => {
                setApiBaseUrlDraft(event.target.value);
                setApiSettingsError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void saveApiSettings();
                }
              }}
              disabled={apiSettingsLoading || apiSettingsSaving}
              placeholder="http://localhost:8080"
              style={apiSettingsInputStyle}
            />
            {apiSettingsError && (
              <div style={apiSettingsErrorStyle}>
                <FormError message={apiSettingsError} type="error" />
              </div>
            )}
            <div style={apiSettingsActionsStyle}>
              <Button
                type="button"
                variant="ghost"
                onClick={closeApiSettings}
                disabled={apiSettingsSaving}
                style={apiSettingsCancelStyle}
              >
                取消
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void testApiSettings()}
                disabled={apiSettingsLoading || apiSettingsTesting || apiSettingsSaving}
                style={apiSettingsTestStyle}
              >
                {apiSettingsTesting ? '测试中' : '测试'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void saveApiSettings()}
                disabled={apiSettingsLoading || apiSettingsSaving || apiSettingsTesting}
                style={apiSettingsSaveStyle}
              >
                {apiSettingsSaving ? '保存中' : '保存'}
              </Button>
            </div>
          </div>
        </>
      )}
      <section style={panelStyle}>
        <div style={logoStyle}>S</div>
        <h1 style={titleStyle}>SkillStack</h1>
        <p style={subtitleStyle}>登录以开始使用</p>

        {isWaiting ? (
          <div style={waitingWrapStyle}>
            <div style={waitingTextStyle}>
              <Spinner size={22} label="等待登录" style={{ borderWidth: 3 }} />
              请在浏览器中完成登录
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={cancelLogin}
              style={cancelButtonStyle}
            >
              取消
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="dark"
            size="lg"
            full
            onClick={() => void startLogin()}
            disabled={isDone}
            style={loginButtonStyle}
          >
            通过浏览器登录
          </Button>
        )}

        {isDone && (
          <div style={{ marginTop: 18 }}>
            <FormError message="登录成功，正在进入桌面端" type="hint" />
          </div>
        )}
      </section>
      <div style={versionStyle}>v0.1.0</div>
    </div>
  );
}

function validateApiBaseUrl(value: string): string {
  if (!value) {
    return '请输入服务 API 地址';
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '请输入 http 或 https 地址';
    }
    return '';
  } catch {
    return '服务 API 地址格式不正确';
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message || fallback : fallback;
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: TOKENS.bg,
  display: 'grid',
  placeItems: 'center',
  position: 'relative',
};

const dragRegionStyle: DraggableRegionStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 56,
  WebkitAppRegion: 'drag',
};

const settingsButtonStyle: NoDragRegionStyle = {
  position: 'absolute',
  top: 16,
  right: 18,
  zIndex: 3,
  width: 32,
  height: 32,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 0,
  borderRadius: 6,
  background: 'transparent',
  color: TOKENS.text3,
  cursor: 'pointer',
  padding: 0,
  WebkitAppRegion: 'no-drag',
};

const apiSettingsClickAwayStyle: NoDragRegionStyle = {
  position: 'absolute',
  inset: 0,
  zIndex: 2,
  background: 'transparent',
  WebkitAppRegion: 'no-drag',
};

const apiSettingsPopoverStyle: NoDragRegionStyle = {
  position: 'absolute',
  top: 56,
  right: 18,
  zIndex: 4,
  width: 320,
  padding: 18,
  display: 'grid',
  gap: 12,
  border: `1px solid ${TOKENS.border}`,
  borderRadius: 10,
  background: '#fff',
  boxShadow: '0 18px 48px rgba(15,23,42,.14)',
  textAlign: 'left',
  WebkitAppRegion: 'no-drag',
};

const apiSettingsHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gap: 5,
};

const apiSettingsTitleStyle: React.CSSProperties = {
  color: TOKENS.text,
  fontSize: 16,
  lineHeight: 1.25,
  fontWeight: 780,
};

const apiSettingsHintStyle: React.CSSProperties = {
  color: TOKENS.text3,
  fontSize: 12,
  lineHeight: 1.5,
};

const apiSettingsLabelStyle: React.CSSProperties = {
  color: TOKENS.text2,
  fontSize: 13,
  fontWeight: 650,
};

const apiSettingsInputStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 7,
  fontSize: 14,
};

const apiSettingsErrorStyle: React.CSSProperties = {
  marginTop: -4,
};

const apiSettingsActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 2,
};

const apiSettingsCancelStyle: React.CSSProperties = {
  height: 34,
  border: 0,
  background: 'transparent',
  color: TOKENS.text3,
  fontSize: 14,
};

const apiSettingsTestStyle: React.CSSProperties = {
  height: 34,
  minWidth: 72,
  borderRadius: 7,
  borderColor: TOKENS.border,
  background: '#fff',
  color: TOKENS.text2,
  fontSize: 14,
};

const apiSettingsSaveStyle: React.CSSProperties = {
  height: 34,
  minWidth: 72,
  borderRadius: 7,
  borderColor: TOKENS.primarySoft,
  background: TOKENS.primarySoft,
  color: TOKENS.text2,
  fontSize: 14,
  fontWeight: 500,
};

const panelStyle: React.CSSProperties = {
  width: 320,
  textAlign: 'center',
};

const logoStyle: React.CSSProperties = {
  width: 72,
  height: 72,
  border: `1px solid ${TOKENS.border}`,
  borderRadius: 18,
  background: TOKENS.bg,
  margin: '0 auto 36px',
  display: 'grid',
  placeItems: 'center',
  color: TOKENS.text,
  boxShadow: '0 14px 34px rgba(15,23,42,.06)',
  fontSize: 40,
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: 0,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1.08,
  fontWeight: 850,
  color: TOKENS.text,
};

const subtitleStyle: React.CSSProperties = {
  margin: '16px 0 26px',
  color: TOKENS.text2,
  fontSize: 15,
};

const loginButtonStyle: React.CSSProperties = {
  width: 230,
  maxWidth: '100%',
  borderRadius: 28,
  height: 54,
  fontSize: 15,
  fontWeight: 750,
};

const waitingWrapStyle: React.CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: 26,
  marginTop: 28,
};

const waitingTextStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 12,
  color: TOKENS.text2,
  fontSize: 16,
  fontWeight: 500,
};

const cancelButtonStyle: React.CSSProperties = {
  border: 0,
  background: 'transparent',
  color: TOKENS.text3,
  font: 'inherit',
  fontSize: 15,
  lineHeight: 1.4,
  fontWeight: 500,
  cursor: 'pointer',
  padding: 0,
};

const versionStyle: React.CSSProperties = {
  position: 'absolute',
  right: 36,
  bottom: 32,
  color: TOKENS.text3,
  fontWeight: 650,
  fontSize: 14,
};
