import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { Avatar, Button, Card, Divider, OptionCard, OptionGroup, toast } from '@/components/ui';
import { I } from '@/components/icons';
import { useCurrentTeam } from '@/api/data';
import { teamApi } from '@/api/endpoints';
import type { TeamMember, TeamRole } from '@/mocks/team';

const ROLES: { role: TeamRole; desc: string }[] = [
  { role: 'Owner', desc: '完整权限,可修改团队资料、审核模式与所有成员角色' },
  { role: 'Admin', desc: '可审核 Skill、管理 Member 与邀请,但不能修改 Owner' },
  { role: 'Member', desc: '可查看团队 Skill、创建草稿、按审核模式提交' },
];

export interface MemberEditPaneProps {
  member: TeamMember;
  onClose: () => void;
}

export function MemberEditPane({ member, onClose }: MemberEditPaneProps) {
  const { teamId } = useCurrentTeam();
  const [role, setRole] = useState<TeamRole>(member.role);
  const queryClient = useQueryClient();
  const userId = (member as TeamMember & { userId?: number }).userId;
  const isOwner = member.role === 'Owner';
  const refreshMembers = () => queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
  const updateRole = useMutation({
    mutationFn: () => teamApi.updateMember(teamId!, userId!, { role: role.toUpperCase() }),
    onSuccess: () => {
      refreshMembers();
      toast({ kind: 'success', message: `${member.name} 的角色已更新为 ${role}` });
      onClose();
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `角色更新失败：${err.message}` : '角色更新失败',
      });
    },
  });
  const removeMember = useMutation({
    mutationFn: () => teamApi.removeMember(teamId!, userId!),
    onSuccess: () => {
      refreshMembers();
      toast({ kind: 'success', message: `已移除 ${member.name}` });
      onClose();
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `移除失败：${err.message}` : '移除失败',
      });
    },
  });

  return (
    <Card pad={18} style={{ alignSelf: 'flex-start', position: 'sticky', top: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Avatar name={member.name} char={member.avatar} url={member.avatarUrl} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{member.name}</div>
          <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>@{member.handle}</div>
        </div>
        <Button variant="ghost"
          type="button"
          onClick={onClose}
          aria-label="关闭成员编辑"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: TOKENS.text3,
          }}
        >
          <I.x size={16} />
        </Button>
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: TOKENS.text2,
          marginBottom: 8,
        }}
      >
        角色
      </div>
      <OptionGroup>
        {ROLES.map(({ role: r, desc }) => {
          const disabled = isOwner || r === 'Owner';
          return (
            <OptionCard
              key={r}
              value={r}
              checked={role === r}
              onChange={(v) => setRole(v as TeamRole)}
              title={r}
              description={desc}
              disabled={disabled}
            />
          );
        })}
      </OptionGroup>

      {isOwner && (
        <div
          style={{
            padding: 10,
            background: '#FFFBEB',
            borderRadius: 6,
            fontSize: 11.5,
            color: '#92400E',
            marginTop: 6,
            display: 'flex',
            gap: 6,
            alignItems: 'flex-start',
          }}
        >
          <I.shield size={12} style={{ marginTop: 2, flex: '0 0 auto' }} />
          <div>第一版中 Owner 不可被移除或降级。如需转让所有权,请在团队设置中操作。</div>
        </div>
      )}

      <Divider style={{ margin: '14px 0' }} />
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: TOKENS.text2,
          marginBottom: 8,
        }}
      >
        危险操作
      </div>
      <Button
        variant="danger"
        size="sm"
        full
        disabled={isOwner || !userId || removeMember.isPending}
        onClick={() => removeMember.mutate()}
        icon={<I.trash size={12} />}
      >
        从团队移除
      </Button>

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 16,
          paddingTop: 14,
          borderTop: `1px solid ${TOKENS.borderSoft}`,
        }}
      >
        <Button variant="secondary" size="md" onClick={onClose}>
          取消
        </Button>
        <Button
          variant="primary"
          size="md"
          full
          disabled={role === member.role || !userId || updateRole.isPending}
          onClick={() => updateRole.mutate()}
        >
          {updateRole.isPending ? '保存中…' : '保存修改'}
        </Button>
      </div>
    </Card>
  );
}
