import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, DashTopBar, toast } from '@/components/ui';
import { useCurrentTeam } from '@/api/data';
import { teamApi } from '@/api/endpoints';
import { AdminShell } from './_shared/AdminShell';
import {
  SettingsProfile,
  type SettingsProfileDraft,
} from './Settings/SettingsProfile';
import {
  SettingsReviewMode,
  type ReviewMode,
} from './Settings/SettingsReviewMode';

const EMPTY_PROFILE: SettingsProfileDraft = {
  name: '',
  slug: '',
  description: '',
  avatar: '',
  color: '#4F46E5',
  logoUrl: '',
  publicHome: true,
};

export default function AdminSettings() {
  const { teamId } = useCurrentTeam();
  const [mode, setMode] = useState<ReviewMode>('REVIEW_REQUIRED');
  const [profile, setProfile] = useState<SettingsProfileDraft>(EMPTY_PROFILE);
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ['team-settings', teamId],
    queryFn: () => teamApi.settings(teamId!),
    enabled: !!teamId,
  });
  const saveSettings = useMutation({
    mutationFn: () =>
      teamApi.updateSettings(teamId!, {
        name: profile.name,
        description: profile.description,
        avatarChar: profile.avatar,
        color: profile.color,
        reviewMode: mode,
        publicHome: profile.publicHome,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-settings', teamId] });
      // useTeam() 在成员工作台下用 ['team', teamId]（数字），公开页用 ['team', slug]，两者都需要清
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['team', profile.slug] });
      queryClient.invalidateQueries({ queryKey: ['session', 'me'] });
      toast({ kind: 'success', message: '团队设置已保存' });
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `保存失败：${err.message}` : '保存失败，请稍后重试',
      });
    },
  });
  const uploadLogo = useMutation({
    mutationFn: (file: File) => teamApi.uploadLogo(teamId!, file),
    onSuccess: (data) => {
      setProfile((prev) => ({ ...prev, logoUrl: data.logoUrl }));
      queryClient.invalidateQueries({ queryKey: ['team-settings', teamId] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['team', profile.slug] });
      queryClient.invalidateQueries({ queryKey: ['session', 'me'] });
      toast({ kind: 'success', message: '团队 Logo 已更新' });
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `上传失败：${err.message}` : '上传失败，请稍后重试',
      });
    },
  });

  useEffect(() => {
    if (!settings) return;
    setProfile({
      name: settings.name ?? '',
      slug: settings.slug ?? '',
      description: settings.description ?? '',
      avatar: settings.avatar ?? settings.avatarChar ?? '',
      color: settings.color ?? '#4F46E5',
      logoUrl: settings.logoUrl ?? '',
      publicHome: settings.publicHome ?? true,
    });
    const m = settings.reviewMode;
    if (m === 'REVIEW_REQUIRED' || m === 'DIRECT_PUBLISH') setMode(m);
  }, [settings]);

  return (
    <AdminShell active="settings">
      <DashTopBar
        title="团队设置"
        hint={`${profile.name || '当前团队'} · 基础信息与治理规则`}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => saveSettings.mutate()}
            disabled={saveSettings.isPending}
          >
            {saveSettings.isPending ? '保存中…' : '保存更改'}
          </Button>
        }
      />
      <div style={{ padding: '24px 32px 40px', overflow: 'auto', maxWidth: 880 }}>
        <SettingsProfile
          value={profile}
          onChange={(patch) => setProfile((prev) => ({ ...prev, ...patch }))}
          onLogoSelect={(file) => uploadLogo.mutate(file)}
          logoUploading={uploadLogo.isPending}
        />
        <SettingsReviewMode mode={mode} setMode={setMode} />
      </div>
    </AdminShell>
  );
}
