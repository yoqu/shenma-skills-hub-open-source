import type { TeamRole } from './team';

export type InviteStatus = 'active' | 'exhausted' | 'expired' | 'revoked';
export type PhoneInviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface Invite {
  code: string;
  uses: number;
  max: number;
  expiresIn: string;
  createdBy: string;
  createdAt: string;
  role: TeamRole;
  status: InviteStatus;
}

export interface PhoneInvite {
  id?: number;
  phone: string;
  invitedBy: string;
  at: string;
  note: string;
  status: PhoneInviteStatus;
}

export const INVITES: Invite[] = [
  { code: 'LD-FE-7K3M', uses: 3, max: 10, expiresIn: '14 天', createdBy: '林子睿', createdAt: '2026-05-08', role: 'Member', status: 'active' },
  { code: 'LD-FE-INTERN-26', uses: 12, max: 20, expiresIn: '7 天', createdBy: '赵一辰', createdAt: '2026-05-12', role: 'Member', status: 'active' },
  { code: 'LD-FE-LEAD-Q2', uses: 1, max: 3, expiresIn: '30 天', createdBy: '林子睿', createdAt: '2026-05-01', role: 'Admin', status: 'active' },
  { code: 'LD-FE-OLD-X1', uses: 8, max: 8, expiresIn: '已用完', createdBy: '林子睿', createdAt: '2026-03-12', role: 'Member', status: 'exhausted' },
];

export const PHONE_INVITES: PhoneInvite[] = [
  { phone: '138****4421', invitedBy: '林子睿', at: '2 小时前', note: '后端组借调', status: 'pending' },
  { phone: '139****1098', invitedBy: '赵一辰', at: '昨天', note: '新入职 / 周五入组', status: 'pending' },
  { phone: '137****7732', invitedBy: '赵一辰', at: '3 天前', note: '', status: 'accepted' },
  { phone: '186****0021', invitedBy: '林子睿', at: '5 天前', note: '设计协作', status: 'declined' },
];
