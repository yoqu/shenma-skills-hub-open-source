import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { accountApi, authApi } from '@/api/endpoints';
import { getToken } from '@/api/client';
import { Avatar, Button, Card, FormError, FormField, Input, SectionHeader, AvatarUpload } from '@/components/ui';

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

export default function BasicProfile() {
  const queryClient = useQueryClient();
  const token = getToken();

  const meQuery = useQuery({
    queryKey: ['session', 'profile'],
    queryFn: () => authApi.me(),
    enabled: !!token,
  });
  const me = meQuery.data as Record<string, any> | undefined;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarChar, setAvatarChar] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [profileStatus, setProfileStatus] = useState<Status>('idle');
  const [profileMessage, setProfileMessage] = useState('');

  useEffect(() => {
    if (!me) return;
    setName(String(me.name ?? ''));
    setEmail(String(me.email ?? ''));
    setAvatarChar(String(me.avatar ?? ''));
  }, [me]);

  function validateName(): boolean {
    if (!name.trim()) {
      setErrors((prev) => ({ ...prev, name: '显示名不能为空' }));
      return false;
    }
    if (name.length > 64) {
      setErrors((prev) => ({ ...prev, name: '最多 64 个字符' }));
      return false;
    }
    setErrors((prev) => ({ ...prev, name: '' }));
    return true;
  }

  function validateEmail(): boolean {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors((prev) => ({ ...prev, email: '请输入有效的邮箱地址' }));
      return false;
    }
    setErrors((prev) => ({ ...prev, email: '' }));
    return true;
  }

  const updateProfile = useMutation({
    mutationFn: () =>
      accountApi.updateProfile({
        name: name.trim(),
        email: email.trim() || undefined,
        avatar: avatarChar.trim() || undefined,
      }),
    onSuccess: async () => {
      setProfileStatus('success');
      setProfileMessage('个人资料已保存');
      await queryClient.invalidateQueries({ queryKey: ['session'] });
    },
    onError: (e) => {
      setProfileStatus('error');
      setProfileMessage(e instanceof Error ? e.message : '保存失败');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileStatus('idle');
    setProfileMessage('');
    const nameOk = validateName();
    const emailOk = validateEmail();
    if (!nameOk || !emailOk) return;
    updateProfile.mutate();
  }

  const displayChar = avatarChar || (me?.name ? String(me.name).slice(0, 1) : '?');

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: TOKENS.text, marginBottom: 6 }}>基础资料</h2>
      <p style={{ fontSize: 13, color: TOKENS.text3, marginBottom: 24 }}>管理你的公开展示信息</p>

      {/* Avatar card */}
      <Card pad={24} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <AvatarUpload
            currentUrl={me?.avatarUrl}
            currentChar={me?.avatar}
            name={me?.name || ''}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['session'] });
            }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: TOKENS.text, marginBottom: 4 }}>头像</div>
            <div style={{ fontSize: 12, color: TOKENS.text3 }}>支持 JPG / PNG / GIF / WebP，最大 2MB</div>
            <div style={{ fontSize: 12, color: TOKENS.text3, marginTop: 2 }}>点击头像更换</div>
          </div>
        </div>
      </Card>

      {/* Profile form card */}
      <Card pad={24}>
        <form onSubmit={handleSubmit}>
          <SectionHeader title="基本信息" hint="这些信息会显示在公开资料页和团队成员列表中" />
          <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
            {/* Handle - read only */}
            <FormField label="用户名">
              <Input
                value={me?.handle || ''}
                disabled
                style={{ background: TOKENS.bgGray, color: TOKENS.text3 }}
              />
            </FormField>

            {/* Display name - required */}
            <FormField label="显示名" required>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors((prev) => ({ ...prev, name: '' }));
                }}
                onBlur={() => validateName()}
                maxLength={64}
              />
              {errors.name && <FormError>{errors.name}</FormError>}
            </FormField>

            {/* Email - optional */}
            <FormField label="邮箱">
              <Input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, email: '' }));
                }}
                onBlur={() => validateEmail()}
                type="email"
                maxLength={128}
              />
              {errors.email && <FormError>{errors.email}</FormError>}
            </FormField>

            {/* Avatar char - optional */}
            <FormField label="头像字符" hint="无头像图片时作为占位显示，支持 1 个汉字、字母或 emoji">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Input
                  value={avatarChar}
                  onChange={(e) => setAvatarChar(e.target.value)}
                  maxLength={8}
                  style={{ flex: 1 }}
                />
                <div
                  style={{
                    flexShrink: 0,
                    borderRadius: '50%',
                    padding: 2,
                    boxShadow: `0 0 0 1.5px ${TOKENS.primary}40`,
                  }}
                >
                  <Avatar
                    name={me?.name || 'U'}
                    char={displayChar}
                    size={36}
                    color={TOKENS.primary}
                  />
                </div>
              </div>
            </FormField>
          </div>

          <StatusLine status={profileStatus} message={profileMessage} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <Button type="submit" disabled={updateProfile.isPending || meQuery.isLoading}>
              {updateProfile.isPending ? '保存中…' : '保存'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
