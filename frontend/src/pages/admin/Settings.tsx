import { useEffect, useRef, useState } from 'react';
import { TOKENS } from '@/lib/tokens';
import {
  Button,
  Card,
  DashTopBar,
  FormField,
  Input,
  Textarea,
  toast,
} from '@/components/ui';
import { I } from '@/components/icons';
import {
  useAdminSettings,
  useUpdateAdminSettings,
  useUploadLogo,
} from '@/api/admin';
import { useBrandingStore } from '@/store/branding';
import { AdminLayout } from './AdminLayout';

interface SettingsDraft {
  name: string;
  tagline: string;
  footer: string;
}

const EMPTY: SettingsDraft = { name: '', tagline: '', footer: '' };

export default function AdminSettingsPage() {
  const settingsQuery = useAdminSettings();
  const updateSettings = useUpdateAdminSettings();
  const uploadLogo = useUploadLogo();
  const brandingName = useBrandingStore((s) => s.name);
  const brandingLogoUrl = useBrandingStore((s) => s.logoUrl);
  const brandingTagline = useBrandingStore((s) => s.tagline);
  const brandingFooter = useBrandingStore((s) => s.footer);
  const branding = { name: brandingName, logoUrl: brandingLogoUrl, tagline: brandingTagline, footer: brandingFooter };
  const [draft, setDraft] = useState<SettingsDraft>(EMPTY);
  const fileRef = useRef<HTMLInputElement>(null);

  // 把后端 setting 列表映射成 form draft
  useEffect(() => {
    const items = settingsQuery.data ?? [];
    if (items.length === 0) return;
    const map = Object.fromEntries(items.map((it) => [it.key, it.value ?? '']));
    setDraft({
      name: map['site.name'] ?? '',
      tagline: map['site.tagline'] ?? '',
      footer: map['site.footer'] ?? '',
    });
  }, [settingsQuery.data]);

  const onSave = () => {
    updateSettings.mutate(
      {
        'site.name': draft.name,
        'site.tagline': draft.tagline,
        'site.footer': draft.footer,
      },
      {
        onSuccess: () => toast({ kind: 'success', message: '站点设置已保存' }),
        onError: (err) =>
          toast({
            kind: 'error',
            message: err instanceof Error ? `保存失败：${err.message}` : '保存失败',
          }),
      },
    );
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    uploadLogo.mutate(f, {
      onSuccess: () => toast({ kind: 'success', message: 'Logo 已上传' }),
      onError: (err) =>
        toast({
          kind: 'error',
          message: err instanceof Error ? `上传失败：${err.message}` : '上传失败',
        }),
    });
    // 允许连续选择同一文件
    e.target.value = '';
  };

  return (
    <AdminLayout active="settings">
      <DashTopBar
        title="站点设置"
        hint="编辑全站品牌信息；保存后所有页面立即生效"
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={onSave}
            disabled={updateSettings.isPending}
          >
            {updateSettings.isPending ? '保存中…' : '保存'}
          </Button>
        }
      />
      <div style={{ padding: '24px 32px 40px', overflow: 'auto', display: 'grid', gap: 16, maxWidth: 880 }}>
        <Card pad={20}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>品牌信息</div>
          <div style={{ display: 'grid', gap: 12 }}>
            <FormField label="站点名称" required>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="例如：SkillStack"
                maxLength={64}
              />
            </FormField>
            <FormField label="副标题（可选）" hint="出现在登录页、首页等位置">
              <Input
                value={draft.tagline}
                onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))}
                placeholder="一句话标语，例如：团队 Skill 协作平台"
                maxLength={120}
              />
            </FormField>
            <FormField label="Footer / 版权文案（可选）">
              <Textarea
                value={draft.footer}
                onChange={(e) => setDraft((d) => ({ ...d, footer: e.target.value }))}
                placeholder="© 2026 Your Company. All rights reserved."
                rows={3}
                maxLength={240}
              />
            </FormField>
          </div>
        </Card>

        <Card pad={20}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>站点 Logo</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 14,
                background: TOKENS.bgAlt,
                border: `1px dashed ${TOKENS.border}`,
                display: 'grid',
                placeItems: 'center',
                overflow: 'hidden',
              }}
            >
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt="当前 Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <I.shield size={28} style={{ color: TOKENS.text3 }} />
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={onPickFile}
                style={{ display: 'none' }}
              />
              <Button
                variant="secondary"
                size="sm"
                icon={<I.upload size={13} />}
                onClick={() => fileRef.current?.click()}
                disabled={uploadLogo.isPending}
              >
                {uploadLogo.isPending ? '上传中…' : '上传新的 Logo'}
              </Button>
              <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>
                建议方形 PNG / SVG，512×512 以上。上传后立即生效。
              </div>
            </div>
          </div>
        </Card>

        <Card pad={20}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>当前预览</div>
          <div style={{ fontSize: 11.5, color: TOKENS.text3, marginBottom: 12 }}>
            来自全局 branding store（保存后立刻同步）
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: 8,
              background: TOKENS.bgAlt,
            }}
          >
            {branding.logoUrl && (
              <img
                src={branding.logoUrl}
                alt=""
                style={{ width: 32, height: 32, objectFit: 'contain' }}
              />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>
                {branding.name || '未设置'}
              </div>
              {branding.tagline && (
                <div style={{ fontSize: 12, color: TOKENS.text3, marginTop: 2 }}>
                  {branding.tagline}
                </div>
              )}
            </div>
          </div>
          {branding.footer && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 12px',
                borderRadius: 8,
                background: TOKENS.bgAlt,
                fontSize: 12,
                color: TOKENS.text2,
              }}
            >
              {branding.footer}
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
