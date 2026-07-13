import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { TOKENS } from '@/lib/tokens';
import { Avatar, Button, Input, Select, toast } from '@/components/ui';
import { I } from '@/components/icons';
import { useAdminUsers, useAddAdminTeamMember } from '@/api/admin';
import type { AdminUserListItem } from '@/api/endpoints';

interface Props {
  open: boolean;
  teamId: number;
  teamName: string;
  onClose: () => void;
}

export function AddMemberDialog({ open, teamId, teamName, onClose }: Props) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<AdminUserListItem | null>(null);
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!open) {
      setQ(''); setDebounced(''); setPicked(null); setRole('MEMBER');
    }
  }, [open]);

  const listQuery = useAdminUsers(debounced.length >= 1 ? { q: debounced, size: 8 } : {});
  const items = useMemo(
    () => (debounced ? (listQuery.data?.items ?? listQuery.data?.records ?? []) : []),
    [listQuery.data, debounced],
  );

  const add = useAddAdminTeamMember(teamId);

  if (!open) return null;

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>添加成员到 {teamName}</div>

        <div style={{ position: 'relative' }}>
          <Input
            autoFocus
            placeholder="搜 handle / 姓名 / 邮箱 / 手机号"
            value={q}
            onChange={(e) => { setPicked(null); setQ(e.target.value); }}
            style={{ width: '100%' }}
          />
          {debounced && !picked && (
            <div style={dropdown}>
              {listQuery.isLoading ? (
                <div style={dropdownEmpty}>搜索中…</div>
              ) : items.length === 0 ? (
                <div style={dropdownEmpty}>没有匹配的用户</div>
              ) : (
                items.map((u) => (
                  <div
                    key={u.id}
                    style={dropdownItem}
                    onClick={() => { setPicked(u); setQ(`${u.name} (@${u.handle})`); }}
                  >
                    <Avatar name={u.name} char={(u.name || u.handle || 'U').slice(0, 1)} url={u.avatarUrl} size={24} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{u.name || u.handle}</div>
                      <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>
                        @{u.handle} · {u.email || '—'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <span style={{ fontSize: 12, color: TOKENS.text3 }}>角色</span>
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')}
            style={{ width: 140, height: 32, padding: '0 28px 0 10px', fontSize: 13 }}
            options={[
              { value: 'MEMBER', label: 'Member' },
              { value: 'ADMIN', label: 'Admin' },
            ]}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!picked || add.isPending}
            onClick={() => {
              if (!picked) return;
              add.mutate(
                { userId: picked.id, role },
                {
                  onSuccess: () => {
                    toast({ kind: 'success', message: `已加入 @${picked.handle}` });
                    onClose();
                  },
                  onError: (e) =>
                    toast({ kind: 'error', message: e instanceof Error ? e.message : '操作失败' }),
                },
              );
            }}
          >
            <I.plus size={12} /> 加入
          </Button>
        </div>
      </div>
    </div>
  );
}

const backdrop: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)',
  display: 'grid', placeItems: 'center', zIndex: 60,
};
const modal: CSSProperties = {
  background: '#fff', borderRadius: 10, padding: 20, width: 460, maxWidth: '90vw',
  boxShadow: '0 10px 30px rgba(15,23,42,.18)',
};
const dropdown: CSSProperties = {
  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
  background: '#fff', border: `1px solid ${TOKENS.border}`, borderRadius: 8,
  boxShadow: '0 6px 20px rgba(15,23,42,.08)', maxHeight: 280, overflow: 'auto', zIndex: 1,
};
const dropdownItem: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', cursor: 'pointer',
};
const dropdownEmpty: CSSProperties = {
  padding: '12px', fontSize: 12, color: TOKENS.text3, textAlign: 'center',
};
