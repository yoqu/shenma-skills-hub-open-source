import { TOKENS } from '@/lib/tokens';
import { Badge, Button, Checkbox, FormField, Input, PhoneInput, OptionCard, OptionGroup, TeamAvatar } from '@/components/ui';
import { usePublicTeams } from '@/api/data';
import type { RegisterState } from './types';

export interface Step1Props {
  state: RegisterState;
  update: (patch: Partial<RegisterState>) => void;
  submitting?: boolean;
}

export function Step1Basic({ state, update, submitting = false }: Step1Props) {
  const { phone, inviteCode, joinMode, agree } = state;
  const { data: teams = [] } = usePublicTeams();
  const inviteTeam = teams[0];
  const inviteValid = inviteCode.length >= 6;
  const teamReady = joinMode === 'none' || (joinMode === 'invite' && inviteValid);
  const phoneValid = phone.length === 11;
  const canNext = agree && phoneValid && teamReady;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <FormField label="手机号" required>
        <PhoneInput
          value={phone}
          onChange={(raw) => update({ phone: raw })}
        />
      </FormField>

      {/* 加入团队方式切换 */}
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: TOKENS.text2,
            display: 'block',
            marginBottom: 8,
          }}
        >
          加入团队 <span style={{ color: TOKENS.text3, fontWeight: 400 }}>(可选)</span>
        </div>
        <OptionGroup direction="horizontal">
          <OptionCard
            value="invite"
            checked={joinMode === 'invite'}
            onChange={(v) => update({ joinMode: v as 'invite' | 'none' })}
            title="邀请码加入"
            description="输入团队给你的邀请码"
          />
          <OptionCard
            value="none"
            checked={joinMode === 'none'}
            onChange={(v) => update({ joinMode: v as 'invite' | 'none' })}
            title="仅创建个人账号"
            description="可稍后通过邀请加入团队"
          />
        </OptionGroup>

        {joinMode === 'invite' && (
          <div style={{ marginTop: 8 }}>
            <Input
              value={inviteCode}
              onChange={(e) => update({ inviteCode: e.target.value.toUpperCase() })}
              placeholder="LUDOU-FE-2025"
              state={inviteValid ? 'success' : 'default'}
              style={{
                padding: '11px 12px',
                fontSize: 14,
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                letterSpacing: 0.5,
                background: inviteValid ? '#F0FDF4' : '#fff',
              }}
            />
            <div
              style={{
                fontSize: 11.5,
                color: TOKENS.text3,
                marginTop: 5,
                lineHeight: 1.5,
              }}
            >
              {inviteValid ? (
                <span>
                  <span style={{ color: TOKENS.success, fontWeight: 500 }}>● 已识别</span> ·
                  加入「{inviteTeam?.name || '当前团队'}」, 默认角色 Member
                </span>
              ) : (
                '留空将仅创建个人账号,可稍后通过邀请加入团队。'
              )}
            </div>

            {inviteValid && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 10,
                  background: TOKENS.bgAlt,
                  borderRadius: 8,
                  border: `1px solid ${TOKENS.borderSoft}`,
                  marginTop: 8,
                }}
              >
                <TeamAvatar
                  name={inviteTeam?.name}
                  avatar={inviteTeam?.avatar}
                  logoUrl={inviteTeam?.logoUrl}
                  color={inviteTeam?.color || TOKENS.primary}
                  size={32}
                  radius={6}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: TOKENS.text,
                    }}
                  >
                    {inviteTeam?.name || '当前团队'}
                  </div>
                  <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>
                    邀请码加入 · {inviteTeam?.members ?? 0} 名成员 · {inviteTeam?.publicSkills ?? 0} 个公开 Skill
                  </div>
                </div>
                <Badge tone="primary" size="sm">
                  Member
                </Badge>
              </div>
            )}
          </div>
        )}

        {joinMode === 'none' && (
          <div
            style={{
              fontSize: 11.5,
              color: TOKENS.text3,
              marginTop: 8,
              lineHeight: 1.5,
              padding: 10,
              background: TOKENS.bgAlt,
              borderRadius: 8,
              border: `1px solid ${TOKENS.borderSoft}`,
            }}
          >
            将仅创建个人账号,可在注册完成后随时通过邀请码加入团队。
          </div>
        )}
      </div>

      <label
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start',
          fontSize: 12,
          color: TOKENS.text2,
          marginTop: 4,
          cursor: 'pointer',
        }}
      >
        <Checkbox
          checked={agree}
          onChange={(e) => update({ agree: e.target.checked })}
          style={{ marginTop: 2 }}
        />
        <span style={{ lineHeight: 1.5 }}>
          我已阅读并同意{' '}
          <a href="/terms" style={{ color: TOKENS.primary }}>
            《服务条款》
          </a>{' '}
          与{' '}
          <a href="/privacy" style={{ color: TOKENS.primary }}>
            《隐私政策》
          </a>
        </span>
      </label>

      <Button
        type="submit"
        variant={canNext && !submitting ? 'primary' : 'secondary'}
        size="lg"
        full
        disabled={!canNext || submitting}
        aria-disabled={!canNext || submitting}
        style={
          !canNext || submitting ? { color: TOKENS.text3, cursor: 'not-allowed', marginTop: 4 } : { marginTop: 4 }
        }
      >
        {submitting
          ? '发送中…'
          : canNext
          ? '下一步 · 发送验证码'
          : !phoneValid
            ? '请输入完整手机号'
            : !teamReady
              ? '请输入有效邀请码'
              : '请勾选服务条款'}
      </Button>
    </div>
  );
}
