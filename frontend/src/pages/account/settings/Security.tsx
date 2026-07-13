import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { accountApi, authApi } from '@/api/endpoints';
import { getToken } from '@/api/client';
import { Button, Card, FormField, Input, PhoneInput, SectionHeader } from '@/components/ui';
import { I } from '@/components/icons';

type Status = 'idle' | 'success' | 'error';

function StatusLine({ status, message }: { status: Status; message: string }) {
  if (!message) return null;
  const isSuccess = status === 'success';
  const isError = status === 'error';
  const color = isSuccess ? TOKENS.success : isError ? TOKENS.danger : TOKENS.text3;
  const bg = isSuccess ? '#F0FDF4' : isError ? '#FEF2F2' : TOKENS.bgGray;
  return (
    <div
      role={isError ? 'alert' : 'status'}
      style={{
        marginTop: 14,
        padding: '9px 12px',
        borderRadius: 7,
        background: bg,
        borderLeft: `3px solid ${color}`,
        fontSize: 13,
        color,
        lineHeight: 1.4,
      }}
    >
      {message}
    </div>
  );
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '').slice(0, 11);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function Security() {
  const queryClient = useQueryClient();
  const token = getToken();

  const meQuery = useQuery({
    queryKey: ['session', 'profile'],
    queryFn: () => authApi.me(),
    enabled: !!token,
  });
  const me = meQuery.data as Record<string, any> | undefined;

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<Status>('idle');
  const [passwordMessage, setPasswordMessage] = useState('');

  // Phone state
  const [phonePassword, setPhonePassword] = useState('');
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [phoneStatus, setPhoneStatus] = useState<Status>('idle');
  const [phoneMessage, setPhoneMessage] = useState('');

  useEffect(() => {
    if (!me) return;
    setPhone(normalizePhone(String(me.phone ?? '')));
  }, [me]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = window.setInterval(() => {
      setCountdown((v) => (v <= 1 ? 0 : v - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [countdown]);

  const changePassword = useMutation({
    mutationFn: () =>
      accountApi.changePassword({
        currentPassword,
        newPassword,
      }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatus('success');
      setPasswordMessage('密码已修改，当前登录状态保持有效');
    },
    onError: (e) => {
      setPasswordStatus('error');
      setPasswordMessage(errorMessage(e, '密码修改失败'));
    },
  });

  const changePhone = useMutation({
    mutationFn: () =>
      accountApi.changePhone({
        currentPassword: phonePassword,
        phone,
        smsCode,
      }),
    onSuccess: async () => {
      setPhonePassword('');
      setSmsCode('');
      setPhoneStatus('success');
      setPhoneMessage('手机号已更新');
      await queryClient.invalidateQueries({ queryKey: ['session'] });
    },
    onError: (e) => {
      setPhoneStatus('error');
      setPhoneMessage(errorMessage(e, '手机号修改失败'));
    },
  });

  async function sendSmsCode() {
    if (sendingCode || countdown > 0) return;
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setPhoneStatus('error');
      setPhoneMessage('请输入有效的中国大陆手机号');
      return;
    }
    setSendingCode(true);
    setPhoneStatus('idle');
    setPhoneMessage('');
    try {
      const { authApi: api } = await import('@/api/endpoints');
      await api.smsCode(phone);
      setCountdown(60);
      setPhoneMessage('验证码已发送');
    } catch (e) {
      setPhoneStatus('error');
      setPhoneMessage(errorMessage(e, '验证码发送失败'));
    } finally {
      setSendingCode(false);
    }
  }

  function submitPassword(e: FormEvent) {
    e.preventDefault();
    setPasswordStatus('idle');
    setPasswordMessage('');
    if (newPassword.length < 6) {
      setPasswordStatus('error');
      setPasswordMessage('新密码至少 6 个字符');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus('error');
      setPasswordMessage('两次输入的新密码不一致');
      return;
    }
    changePassword.mutate();
  }

  function submitPhone(e: FormEvent) {
    e.preventDefault();
    setPhoneStatus('idle');
    setPhoneMessage('');
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setPhoneStatus('error');
      setPhoneMessage('请输入有效的中国大陆手机号');
      return;
    }
    if (!/^\d{6}$/.test(smsCode)) {
      setPhoneStatus('error');
      setPhoneMessage('请输入 6 位验证码');
      return;
    }
    changePhone.mutate();
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: TOKENS.text, marginBottom: 6 }}>安全设置</h2>
      <p style={{ fontSize: 13, color: TOKENS.text3, marginBottom: 24 }}>管理你的密码和手机号</p>

      {/* Change password card */}
      <Card pad={24} style={{ marginBottom: 20 }}>
        <form onSubmit={submitPassword}>
          <input type="text" value={me?.handle || ''} autoComplete="username" readOnly hidden />
          <SectionHeader
            title="修改密码"
            hint="修改成功后，当前登录状态保持有效"
            extra={<I.shield size={16} style={{ color: TOKENS.text3 }} />}
          />
          <div style={{ display: 'grid', gap: 14, marginTop: 20 }}>
            <FormField label="当前密码" required>
              <Input
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
              />
            </FormField>
            <FormField label="新密码" required>
              <Input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
              />
            </FormField>
            <FormField label="确认新密码" required>
              <Input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
              />
            </FormField>
          </div>
          <StatusLine status={passwordStatus} message={passwordMessage} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <Button type="submit" variant="secondary" disabled={changePassword.isPending}>
              {changePassword.isPending ? '提交中…' : '修改密码'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Change phone card */}
      <Card pad={24}>
        <form onSubmit={submitPhone}>
          <input type="text" value={me?.handle || ''} autoComplete="username" readOnly hidden />
          <SectionHeader title="修改手机号" hint="需要当前密码和新手机号验证码" />
          <div style={{ display: 'grid', gap: 14, marginTop: 20 }}>
            <FormField label="当前密码" required>
              <Input
                value={phonePassword}
                onChange={(e) => setPhonePassword(e.target.value)}
                type="password"
                autoComplete="current-password"
              />
            </FormField>
            <FormField label="新手机号" required>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                state={phone.length > 0 && !/^1[3-9]\d{9}$/.test(phone) ? 'error' : 'default'}
              />
            </FormField>
            <FormField label="验证码" required>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={sendingCode || countdown > 0}
                  onClick={sendSmsCode}
                  style={{ flex: '0 0 112px' }}
                >
                  {countdown > 0 ? `${countdown}s` : sendingCode ? '发送中' : '获取验证码'}
                </Button>
              </div>
            </FormField>
          </div>
          <StatusLine status={phoneStatus} message={phoneMessage} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <Button type="submit" variant="secondary" disabled={changePhone.isPending}>
              {changePhone.isPending ? '提交中…' : '修改手机号'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
