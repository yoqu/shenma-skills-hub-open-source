import { TOKENS } from '@/lib/tokens';
import { Button, FormField, Input, PrefixInput } from '@/components/ui';
import { AVATAR_COLORS, type RegisterState } from './types';

export interface Step3Props {
  state: RegisterState;
  update: (patch: Partial<RegisterState>) => void;
  submitting: boolean;
  onBack: () => void;
}

export function Step3Profile({ state, update, submitting, onBack }: Step3Props) {
  const { avatarColor, name, handle, email, password, passwordConfirm } = state;
  const handleOk = /^[a-z0-9_]{3,32}$/.test(handle);
  const passwordOk = password.length >= 6;
  const confirmOk = passwordOk && password === passwordConfirm;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = name.trim() && handleOk && emailOk && passwordOk && confirmOk;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: avatarColor,
            color: '#fff',
            fontSize: 26,
            fontWeight: 600,
            display: 'grid',
            placeItems: 'center',
            flex: '0 0 auto',
          }}
        >
          {(name && name[0]) || '赵'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: TOKENS.text2, marginBottom: 6 }}>选择头像颜色</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {AVATAR_COLORS.map((c) => (
              <Button variant="ghost"
                key={c}
                type="button"
                onClick={() => update({ avatarColor: c })}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: c,
                  border: c === avatarColor ? '2px solid #fff' : '2px solid transparent',
                  boxShadow: c === avatarColor ? `0 0 0 2px ${c}` : 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <FormField label="姓名 / 昵称" required>
        <Input
          value={name}
          onChange={(e) => update({ name: e.target.value })}
        />
      </FormField>

      <FormField
        label="用户名 (Handle)"
        required
        hint={
          <>
            个人主页地址{' '}
            <span
              style={{
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                color: TOKENS.text2,
              }}
            >
              skill.dev/@{handle || '...'}
            </span>{' '}
            · 注册后不可修改
          </>
        }
        error={handle && !handleOk ? '用户名格式不正确（3-32位小写字母、数字或下划线）' : undefined}
      >
        <PrefixInput
          prefix="@"
          value={handle}
          onChange={(v) => update({ handle: v.replace(/[^a-z0-9_]/gi, '').toLowerCase() })}
          placeholder="your_handle"
          state={handle && !handleOk ? 'error' : handleOk ? 'success' : 'default'}
          inputProps={{
            style: {
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            },
          }}
        />
      </FormField>

      <FormField label="邮箱 (用于接收审核通知)" required>
        <Input
          value={email}
          onChange={(e) => update({ email: e.target.value })}
          type="email"
        />
      </FormField>

      <FormField
        label="登录密码"
        required
        hint={passwordOk ? <span style={{ color: TOKENS.success }}>✓ 强度合格</span> : '至少 6 位,后续用于密码登录'}
      >
        <Input
          value={password}
          onChange={(e) => update({ password: e.target.value })}
          type="password"
          placeholder="至少 6 位"
          autoComplete="new-password"
          state={password && !passwordOk ? 'error' : passwordOk ? 'success' : 'default'}
        />
      </FormField>

      <FormField
        label="确认密码"
        required
        error={
          passwordConfirm && !confirmOk ? (
            <span style={{ color: TOKENS.danger }}>两次输入不一致</span>
          ) : undefined
        }
        hint={
          confirmOk ? (
            <span style={{ color: TOKENS.success }}>✓ 密码匹配</span>
          ) : !passwordConfirm ? (
            '再次输入以确认'
          ) : undefined
        }
      >
        <Input
          value={passwordConfirm}
          onChange={(e) => update({ passwordConfirm: e.target.value })}
          type="password"
          placeholder="再输一次"
          autoComplete="new-password"
          state={passwordConfirm && !confirmOk ? 'error' : confirmOk ? 'success' : 'default'}
        />
      </FormField>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={onBack}
          style={{ flex: '0 0 auto', minWidth: 100 }}
        >
          上一步
        </Button>
        <Button
          type="submit"
          variant={canSubmit && !submitting ? 'primary' : 'secondary'}
          size="lg"
          full
          disabled={!canSubmit || submitting}
          aria-disabled={!canSubmit || submitting}
          style={
            !canSubmit || submitting ? { color: TOKENS.text3, cursor: 'not-allowed' } : undefined
          }
        >
          {submitting ? '创建中…' : '创建账号'}
        </Button>
      </div>
    </div>
  );
}
