/**
 * TanStack Query hooks for the SUPER_ADMIN console (`/admin`).
 *
 * 所有列表 hook 都返回原始 PageResult；mutation 成功后通过 invalidateQueries
 * 清掉对应缓存，UI 自动刷新。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminApi,
  siteApi,
  type AdminSkillsQuery,
  type AdminSuitesQuery,
  type AdminTeamsQuery,
  type AdminUsersQuery,
  type UpdateSmsProviderReq,
  type UpdateProviderReq,
} from './endpoints';
import { useBrandingStore } from '@/store/branding';

/* ─── Site branding ───────────────── */

export function useSiteBranding(enabled = true) {
  return useQuery({
    queryKey: ['site', 'branding'],
    queryFn: () => siteApi.branding(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminSettings(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminApi.listSettings(),
    enabled,
    staleTime: 30_000,
  });
}

export function useUpdateAdminSettings() {
  const qc = useQueryClient();
  const setBranding = useBrandingStore((s) => s.set);
  return useMutation({
    mutationFn: (values: Record<string, string>) => adminApi.updateSettings(values),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      qc.invalidateQueries({ queryKey: ['site', 'branding'] });
      if (res?.branding) setBranding(res.branding);
    },
  });
}

export function useUploadLogo() {
  const qc = useQueryClient();
  const setBranding = useBrandingStore((s) => s.set);
  return useMutation({
    mutationFn: (file: File) => adminApi.uploadLogo(file),
    onSuccess: (branding) => {
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      qc.invalidateQueries({ queryKey: ['site', 'branding'] });
      if (branding) setBranding(branding);
    },
  });
}

/* ─── Users ───────────────────────── */

export function useAdminUsers(query: AdminUsersQuery = {}) {
  return useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: () => adminApi.listUsers(query),
    staleTime: 15_000,
  });
}

export function useAdminUserDetail(id: number | null | undefined) {
  return useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: () => adminApi.userDetail(id as number),
    enabled: typeof id === 'number' && id > 0,
  });
}

function invalidateUserLists(qc: ReturnType<typeof useQueryClient>, id?: number) {
  qc.invalidateQueries({ queryKey: ['admin', 'users'] });
  if (typeof id === 'number') {
    qc.invalidateQueries({ queryKey: ['admin', 'user', id] });
  }
}

export function useDisableUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.disableUser(id),
    onSuccess: (_d, id) => invalidateUserLists(qc, id),
  });
}

export function useEnableUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.enableUser(id),
    onSuccess: (_d, id) => invalidateUserLists(qc, id),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: (id: number) => adminApi.resetUserPassword(id),
  });
}

export function usePromoteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.promoteUser(id),
    onSuccess: (_d, id) => invalidateUserLists(qc, id),
  });
}

export function useDemoteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.demoteUser(id),
    onSuccess: (_d, id) => invalidateUserLists(qc, id),
  });
}

/* ─── Teams ───────────────────────── */

export function useAdminTeams(query: AdminTeamsQuery = {}) {
  return useQuery({
    queryKey: ['admin', 'teams', query],
    queryFn: () => adminApi.listTeams(query),
    staleTime: 15_000,
  });
}

export function useAdminTeamDetail(id: number | null | undefined) {
  return useQuery({
    queryKey: ['admin', 'team', id],
    queryFn: () => adminApi.teamDetail(id as number),
    enabled: typeof id === 'number' && id > 0,
  });
}

function invalidateTeamLists(qc: ReturnType<typeof useQueryClient>, id?: number) {
  qc.invalidateQueries({ queryKey: ['admin', 'teams'] });
  if (typeof id === 'number') {
    qc.invalidateQueries({ queryKey: ['admin', 'team', id] });
  }
}

export function useDisableTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.disableTeam(id),
    onSuccess: (_d, id) => invalidateTeamLists(qc, id),
  });
}

export function useEnableTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.enableTeam(id),
    onSuccess: (_d, id) => invalidateTeamLists(qc, id),
  });
}

export function useUpdateAdminTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: import('./endpoints').AdminUpdateTeamReq }) =>
      adminApi.updateTeam(id, body),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'team', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'teams'] });
    },
  });
}

export function useAdminTeamMembers(
  id: number | null | undefined,
  query: import('./endpoints').AdminTeamMembersQuery = {},
) {
  return useQuery({
    queryKey: ['admin', 'team-members', id, query],
    queryFn: () => adminApi.listTeamMembers(id as number, query),
    enabled: typeof id === 'number' && id > 0,
    staleTime: 15_000,
  });
}

function invalidateTeamMembers(qc: ReturnType<typeof useQueryClient>, id: number) {
  qc.invalidateQueries({ queryKey: ['admin', 'team-members', id] });
  qc.invalidateQueries({ queryKey: ['admin', 'team', id] });
  qc.invalidateQueries({ queryKey: ['admin', 'teams'] });
}

export function useAddAdminTeamMember(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: import('./endpoints').AdminAddTeamMemberReq) =>
      adminApi.addTeamMember(id, body),
    onSuccess: () => invalidateTeamMembers(qc, id),
  });
}

export function useUpdateAdminTeamMemberRole(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: 'ADMIN' | 'MEMBER' }) =>
      adminApi.updateTeamMemberRole(id, userId, role),
    onSuccess: () => invalidateTeamMembers(qc, id),
  });
}

export function useRemoveAdminTeamMember(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => adminApi.removeTeamMember(id, userId),
    onSuccess: () => invalidateTeamMembers(qc, id),
  });
}

/* ─── Skills ──────────────────────── */

export function useAdminSkills(query: AdminSkillsQuery = {}) {
  return useQuery({
    queryKey: ['admin', 'skills', query],
    queryFn: () => adminApi.listSkills(query),
    staleTime: 15_000,
  });
}

export function useUnpublishSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.unpublishSkill(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'skills'] });
    },
  });
}

/* ─── Suites ──────────────────────── */

export function useAdminSuites(query: AdminSuitesQuery = {}) {
  return useQuery({
    queryKey: ['admin', 'suites', query],
    queryFn: () => adminApi.listSuites(query),
    staleTime: 15_000,
  });
}

export function useUnpublishSuite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.unpublishSuite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'suites'] });
    },
  });
}

/* ─── OAuth Providers ─────────────── */

export function useAdminOAuthProviders(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'oauth-providers'],
    queryFn: () => adminApi.listOAuthProviders(),
    enabled,
    staleTime: 30_000,
  });
}

export function useAdminOAuthProvider(code: string | null | undefined) {
  return useQuery({
    queryKey: ['admin', 'oauth-provider', code],
    queryFn: () => adminApi.getOAuthProvider(code as string),
    enabled: typeof code === 'string' && code.length > 0,
  });
}

export function useUpdateAdminOAuthProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, body }: { code: string; body: UpdateProviderReq }) =>
      adminApi.updateOAuthProvider(code, body),
    onSuccess: (_d, { code }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'oauth-providers'] });
      qc.invalidateQueries({ queryKey: ['admin', 'oauth-provider', code] });
    },
  });
}

/* ─── SMS Provider ───────────────── */

export function useAdminSmsProvider(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'sms-provider'],
    queryFn: () => adminApi.getSmsProvider(),
    enabled,
    staleTime: 30_000,
  });
}

export function useUpdateAdminSmsProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateSmsProviderReq) => adminApi.updateSmsProvider(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sms-provider'] });
    },
  });
}
