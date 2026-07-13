import { useRef, useState } from 'react';
import { TOKENS } from '@/lib/tokens';
import { Button, Card, SectionHeader, Input, Textarea, PrefixInput, FormField, TeamAvatar } from '@/components/ui';

export interface SettingsProfileDraft {
  name: string;
  slug: string;
  description: string;
  avatar: string;
  color: string;
  logoUrl: string;
  publicHome: boolean;
}

export interface SettingsProfileProps {
  value: SettingsProfileDraft;
  onChange: (patch: Partial<SettingsProfileDraft>) => void;
  onLogoSelect: (file: File) => void;
  logoUploading?: boolean;
}

export function SettingsProfile({ value, onChange, onLogoSelect, logoUploading = false }: SettingsProfileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState('');
  const fields: Array<[string, keyof SettingsProfileDraft, 'text' | 'slug' | 'textarea']> = [
    ['团队名称', 'name', 'text'],
    ['Slug · 团队主页地址', 'slug', 'slug'],
    ['团队介绍', 'description', 'textarea'],
  ];

  function handleLogoClick() {
    if (logoUploading) return;
    fileInputRef.current?.click();
  }

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('仅支持 PNG / JPG / GIF / WebP / SVG 图片');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('图片大小不能超过 2MB');
      return;
    }
    setLogoError('');
    onLogoSelect(file);
  }

  return (
    <Card pad={20} style={{ marginBottom: 16 }}>
      <SectionHeader title="团队资料" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '100px 1fr',
          gap: 16,
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <TeamAvatar
          name={value.name}
          avatar={value.avatar}
          logoUrl={value.logoUrl}
          color={value.color || TOKENS.primary}
          size={80}
          radius={16}
          style={{ border: `1px solid ${TOKENS.border}` }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={handleLogoClick}
            disabled={logoUploading}
            style={{ alignSelf: 'flex-start' }}
          >
            {logoUploading ? '上传中…' : '更换 Logo'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            style={{ display: 'none' }}
            onChange={handleLogoFileChange}
            disabled={logoUploading}
          />
          <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>
            PNG / JPG / SVG · 建议 256×256 以上
          </div>
          {logoError && <div style={{ fontSize: 11.5, color: TOKENS.danger }}>{logoError}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 14 }}>
        {fields.map(([label, key, type]) => (
          <FormField key={label} label={label}>
            {type === 'textarea' ? (
              <Textarea
                value={String(value[key] ?? '')}
                onChange={(e) => onChange({ [key]: e.target.value })}
                style={{ minHeight: 64, fontSize: 13 }}
              />
            ) : type === 'slug' ? (
              <PrefixInput
                prefix="skillstack.test/teams/"
                value={String(value[key] ?? '')}
                onChange={() => {}}
                readOnly
              />
            ) : (
              <Input
                value={String(value[key] ?? '')}
                onChange={(e) => onChange({ [key]: e.target.value })}
                style={{ fontSize: 13 }}
              />
            )}
          </FormField>
        ))}
      </div>
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: 12,
          background: TOKENS.bgAlt,
          borderRadius: 8,
        }}
      >
        <input
          type="checkbox"
          checked={value.publicHome}
          onChange={(e) => onChange({ publicHome: e.target.checked })}
          style={{ marginTop: 3 }}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>对外公开团队主页</div>
          <div
            style={{
              fontSize: 11.5,
              color: TOKENS.text3,
              marginTop: 2,
            }}
          >
            非成员可以浏览团队介绍、公开 Skill 与公开套件,但不能查看私有内容
          </div>
        </div>
      </label>
    </Card>
  );
}
