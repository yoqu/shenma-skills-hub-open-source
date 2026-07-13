import { TOKENS } from '@/lib/tokens';
import { Button } from '@/components/ui';
import { I } from '@/components/icons';
import { usePublicTeams } from '@/api/data';
import type { RegisterState } from './types';

export interface Step4Props {
  state: RegisterState;
  onGo: () => void;
}

export function Step4Done({ state, onGo }: Step4Props) {
  const { handle, joinMode, inviteCode } = state;
  const { data: teams = [] } = usePublicTeams();
  const inviteTeam = teams[0];
  const teamName: string | null =
    joinMode === 'invite' && inviteCode.length >= 6 ? (inviteTeam?.name || '当前团队') : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        padding: '24px 0',
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
      <div style={{ fontSize: 16, fontWeight: 600, color: TOKENS.text }}>账号创建成功</div>
      <div
        style={{
          fontSize: 13,
          color: TOKENS.text2,
          textAlign: 'center',
          lineHeight: 1.7,
        }}
      >
        欢迎加入,<b style={{ color: TOKENS.text }}>@{handle || 'newbie'}</b>
        {teamName ? (
          <>
            <br />
            你已成为 <b style={{ color: TOKENS.primary }}>{teamName}</b> 的 Member
          </>
        ) : (
          <>
            <br />
            个人账号已创建,你可以稍后通过邀请码加入团队
          </>
        )}
      </div>
      <div
        style={{
          width: '100%',
          padding: 14,
          background: TOKENS.bgAlt,
          borderRadius: 10,
          border: `1px solid ${TOKENS.borderSoft}`,
          marginTop: 6,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: TOKENS.text2,
            marginBottom: 10,
          }}
        >
          新手指引
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(
            [
              ['浏览团队 Skill 库', '查看团队沉淀的 14 个公开 + 9 个私有 Skill'],
              ['创建你的第一个 Skill', '通过 4 步向导上传 / 编辑 Skill'],
              ['完善个人主页', '添加简介与 GitHub 等社交链接'],
            ] as const
          ).map(([t, d], i) => (
            <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  background: '#fff',
                  border: `1px solid ${TOKENS.border}`,
                  fontSize: 11,
                  fontWeight: 600,
                  color: TOKENS.text2,
                  display: 'grid',
                  placeItems: 'center',
                  flex: '0 0 auto',
                }}
              >
                {i + 1}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: TOKENS.text,
                  }}
                >
                  {t}
                </div>
                <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Button
        variant="primary"
        size="lg"
        full
        onClick={onGo}
        style={{ marginTop: 4 }}
      >
        进入个人工作台 →
      </Button>
    </div>
  );
}
