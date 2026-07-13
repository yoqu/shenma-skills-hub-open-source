import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useCurrentTeam, useMyTeams } from '@/api/data';
import { accountApi, teamApi } from '@/api/endpoints';
import { TOKENS } from '@/lib/tokens';
import { hashColor } from '@/lib/utils';
import {
  Avatar,
  Button,
  Card,
  DashTopBar,
  Input,
  SectionHeader,
  toast,
} from '@/components/ui';
import { Tabs, type TabItem } from '@/components/chrome';
import { I } from '@/components/icons';
import { NotificationPrefsCard } from '@/components/notifications/NotificationPrefsCard';

type PrefTab = 'notify' | 'profile' | 'danger';

export interface TeamPrefsBodyProps {
  /** Show the "离开团队" tab. Hidden for Admin/Owner workspaces. */
  includeDanger?: boolean;
}

/**
 * 团队工作台"我的偏好"页主体。被 Admin / Member 两套 Shell 各自包裹。
 *  - 通知偏好 / 我的资料 两个 tab 始终可见。
 *  - "离开团队" 仅普通成员可见 (`includeDanger`)。
 *  - Token 管理已收敛到账户设置 → CLI / Tokens，不再在团队偏好里维护。
 */
export function TeamPrefsBody({ includeDanger = false }: TeamPrefsBodyProps) {
  const tabs: TabItem[] = [
    { id: 'notify', label: '通知偏好' },
    { id: 'profile', label: '我的资料' },
    ...(includeDanger ? [{ id: 'danger', label: '离开团队' } as TabItem] : []),
  ];
  const [tab, setTab] = useState<PrefTab>('notify');
  const { teamId } = useCurrentTeam();
  const { data: myTeams } = useMyTeams(true);
  const teamName = myTeams?.find((t) => Number(t.id) === teamId)?.name ?? '当前团队';

  return (
    <>
      <DashTopBar
        title="我的偏好"
        hint={`只影响你在 ${teamName} 的个人体验,不会改变团队规则`}
      />
      <div
        style={{
          background: '#fff',
          borderBottom: `1px solid ${TOKENS.border}`,
          padding: '0 32px',
        }}
      >
        <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as PrefTab)} />
      </div>
      <div
        style={{
          padding: '24px 32px 40px',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          maxWidth: 880,
        }}
      >
        {tab === 'notify' && <NotifyPrefs />}
        {tab === 'profile' && <ProfilePrefs />}
        {tab === 'danger' && includeDanger && <DangerPrefs />}
      </div>
    </>
  );
}

function PrefRow({
  title,
  hint,
  children,
}: {
  title: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 0',
        borderBottom: `1px solid ${TOKENS.borderSoft}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        {hint && (
          <div style={{ fontSize: 11.5, color: TOKENS.text3, marginTop: 2 }}>{hint}</div>
        )}
      </div>
      <div style={{ flex: '0 0 auto' }}>{children}</div>
    </div>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange?: (v: boolean) => void }) {
  return (
    <Button variant="ghost"
      type="button"
      onClick={() => onChange?.(!on)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        background: on ? TOKENS.primary : TOKENS.bgGray,
        position: 'relative',
        transition: 'background .15s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: 999,
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,.15)',
          transition: 'left .15s',
        }}
      />
    </Button>
  );
}

function NotifyPrefs() {
  const { teamId } = useCurrentTeam();
  if (!teamId) {
    return <Card pad={20}><div style={{ color: TOKENS.text3, fontSize: 12 }}>加载中…</div></Card>;
  }
  return <NotificationPrefsCard teamId={teamId} />;
}

function ProfilePrefs() {
  const { teamId } = useCurrentTeam();
  const { data: myTeams, me } = useMyTeams(true);
  const teamName = myTeams?.find((t) => Number(t.id) === teamId)?.name;
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['team-profile', teamId],
    queryFn: () => teamApi.myProfile(teamId!),
    enabled: !!teamId,
  });
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [showEmail, setShowEmail] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    setDisplayName(data.displayName ?? '');
    setBio(data.bio ?? '');
    setShowEmail(!!data.showEmail);
    setDirty(false);
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => teamApi.updateMyProfile(teamId!, { displayName, bio: bio || null, showEmail }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-profile', teamId] });
      toast({ kind: 'success', message: '已保存' });
    },
    onError: (e: any) => toast({ kind: 'error', message: e?.response?.data?.message ?? '保存失败' }),
  });

  if (!teamId || isLoading || !data) {
    return <Card pad={20}><div style={{ color: TOKENS.text3, fontSize: 12 }}>加载中…</div></Card>;
  }

  const reset = () => {
    setDisplayName(data.displayName);
    setBio(data.bio ?? '');
    setShowEmail(!!data.showEmail);
    setDirty(false);
  };

  const onName = (v: string) => { setDisplayName(v); setDirty(true); };
  const onBio = (v: string) => { setBio(v); setDirty(true); };
  const onShowEmail = (v: boolean) => { setShowEmail(v); setDirty(true); };

  return (
    <>
      <Card pad={20}>
        <SectionHeader title="我在团队里的展示" hint={`影响 ${teamName ?? '当前团队'} 内的成员页 / 审核记录 / 团队公开页`} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 0', borderBottom: `1px solid ${TOKENS.borderSoft}`,
        }}>
          <Avatar name={data.displayName} char={(data.displayName?.[0] ?? '?')} url={data.avatarUrl}
                  size={48} color={hashColor(data.handle)} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>头像</div>
            <div style={{ fontSize: 11.5, color: TOKENS.text3, marginTop: 2 }}>
              账号级头像，在所有团队中通用
            </div>
          </div>
          <AvatarUploadButton />
        </div>
        <PrefRow title="显示名" hint="审核记录、活动流里出现的名字">
          <Input value={displayName} onChange={(e) => onName(e.target.value)}
                 style={{ width: 220, height: 30, padding: '0 10px', fontSize: 12.5 }} />
        </PrefRow>
        <PrefRow title="团队内简介" hint="出现在成员卡片下面,限 60 字">
          <Input value={bio} onChange={(e) => onBio(e.target.value)}
                 style={{ width: 320, height: 30, padding: '0 10px', fontSize: 12.5 }} />
        </PrefRow>
        <PrefRow title="允许其他成员查看我的邮箱" hint={`邮箱: ${me?.email ?? '—'}`}>
          <Switch on={showEmail} onChange={onShowEmail} />
        </PrefRow>
      </Card>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="ghost" disabled={!dirty || mutation.isPending} onClick={reset}>放弃修改</Button>
        <Button variant="primary" disabled={!dirty || mutation.isPending || !displayName.trim()}
                onClick={() => mutation.mutate()}>
          {mutation.isPending ? '保存中…' : '保存'}
        </Button>
      </div>
    </>
  );
}

function AvatarUploadButton() {
  const ref = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (f: File) => accountApi.uploadAvatar(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['session', 'me'] }); toast({ kind: 'success', message: '头像已更新' }); },
    onError: (e: any) => toast({ kind: 'error', message: e?.response?.data?.message ?? '头像上传失败' }),
  });
  return (
    <>
      <input ref={ref} type="file" accept="image/*" hidden
             onChange={(e) => { const f = e.target.files?.[0]; if (f) mutation.mutate(f); e.target.value = ''; }} />
      <Button variant="secondary" size="sm" onClick={() => ref.current?.click()}
              disabled={mutation.isPending}>
        {mutation.isPending ? '上传中…' : '更换头像'}
      </Button>
    </>
  );
}

function DangerPrefs() {
  const { teamId } = useCurrentTeam();
  const { data: myTeams } = useMyTeams(true);
  const team = myTeams?.find((t) => Number(t.id) === teamId);
  const qc = useQueryClient();
  const nav = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({
    mutationFn: () => teamApi.leave(teamId!),
    onSuccess: () => {
      toast({ kind: 'success', message: `已离开 ${team?.name ?? '当前团队'}` });
      qc.invalidateQueries({ queryKey: ['session', 'me'] });
      qc.invalidateQueries({ queryKey: ['teams', 'mine'] });
      nav('/home');
    },
    onError: (e: any) => toast({ kind: 'error', message: e?.response?.data?.message ?? '离队失败' }),
  });
  if (!teamId) {
    return <Card pad={20}><div style={{ color: TOKENS.text3, fontSize: 12 }}>加载中…</div></Card>;
  }
  return (
    <Card pad={20} style={{ borderColor: '#FECACA' }}>
      <SectionHeader title="离开团队" hint="离开后你提交的 Skill 仍归属本团队,但你将失去访问权限" />
      <div style={{
        padding: 14, background: '#FEF2F2', borderRadius: 8,
        fontSize: 12.5, color: TOKENS.text2, lineHeight: 1.6, marginBottom: 14,
      }}>
        <b style={{ color: TOKENS.danger }}>注意</b>
        :离开后将立即失去访问 {team?.name ?? '当前团队'} 私有 Skill 与套件的权限,你的 Token 会被吊销。
        如果你是被邀请进来的,需要管理员重新邀请才能再次加入。
      </div>
      {confirming ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" disabled={mutation.isPending} onClick={() => setConfirming(false)}>取消</Button>
          <Button variant="danger" icon={<I.x size={12} />} disabled={mutation.isPending}
                  onClick={() => mutation.mutate()}>
            {mutation.isPending ? '离开中…' : `确认离开 ${team?.name ?? ''}`}
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="danger" icon={<I.x size={12} />} onClick={() => setConfirming(true)}>
            离开 {team?.name ?? '当前团队'}
          </Button>
        </div>
      )}
    </Card>
  );
}
