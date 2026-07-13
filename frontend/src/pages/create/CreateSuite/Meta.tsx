import type { ComponentType } from 'react';
import { TOKENS } from '@/lib/tokens';
import { normalizeSlugInput, slugError, slugify } from '@/lib/slug';
import {
  Button,
  Card,
  FormField,
  Input,
  PrefixInput,
  SectionHeader,
  Textarea,
} from '@/components/ui';
import { I, type IconProps } from '@/components/icons';
import type { Visibility } from '@/mocks/skills';

interface VisOpt {
  v: Visibility;
  icon: ComponentType<IconProps>;
  name: string;
}

const OPTS: VisOpt[] = [
  { v: 'TEAM_PRIVATE', icon: I.lock, name: '团队私有' },
  { v: 'PUBLIC', icon: I.globe, name: '公开发布' },
];

export interface SuiteMetaProps {
  name: string;
  setName: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  desc: string;
  setDesc: (v: string) => void;
  vis: Visibility;
  setVis: (v: Visibility) => void;
  teamSlug: string;
  teamId?: number;
}

export function SuiteMeta({
  name,
  setName,
  slug,
  setSlug,
  desc,
  setDesc,
  vis,
  setVis,
  teamSlug,
  teamId,
}: SuiteMetaProps) {
  const slugIssue = slugError(slug);

  return (
    <Card pad={20}>
      <SectionHeader title="基础信息" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <FormField label="套件名称" required>
          <Input
            value={name}
            onChange={(e) => {
              const nextName = e.target.value;
              setName(nextName);
              if (!slug) setSlug(slugify(nextName));
            }}
          />
        </FormField>
        <FormField
          label="slug · 安装路径"
          required
          hint={slugIssue ?? `安装命令: smskill suite install ${teamId ?? '<teamId>'}/${slug || 'your-slug'}`}
        >
          <PrefixInput
            prefix={`${teamSlug}/`}
            value={slug}
            onChange={(v) => setSlug(normalizeSlugInput(v))}
            placeholder="my-suite"
            state={slugIssue ? 'error' : 'default'}
          />
        </FormField>
      </div>
      <FormField label="描述" hint="解释这个套件适用的场景 · 帮助成员判断是否安装">
        <Textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
        />
      </FormField>
      <div style={{ fontSize: 12, fontWeight: 500, color: TOKENS.text2, marginBottom: 6 }}>
        可见性
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {OPTS.map((o) => {
          const Ico = o.icon;
          const active = vis === o.v;
          return (
            <Button variant="ghost"
              key={o.v}
              type="button"
              onClick={() => setVis(o.v)}
              style={{
                flex: 1,
                padding: 12,
                textAlign: 'left',
                cursor: 'pointer',
                background: active ? TOKENS.primarySoft : '#fff',
                border: `1.5px solid ${active ? TOKENS.primary : TOKENS.border}`,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontFamily: 'inherit',
              }}
            >
              <Ico size={14} style={{ color: active ? TOKENS.primary : TOKENS.text2 }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{o.name}</span>
            </Button>
          );
        })}
      </div>
    </Card>
  );
}
