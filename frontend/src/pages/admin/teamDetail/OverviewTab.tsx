import type { ReactNode } from 'react';
import { TOKENS } from '@/lib/tokens';
import { Badge, Card } from '@/components/ui';
import type { AdminTeamDetail } from '@/api/endpoints';

interface Props {
  detail: AdminTeamDetail;
}

/**
 * AdminTeamDetail 当前后端只暴露基础字段；reviewMode / publicHome / color
 * 等团队自治字段后端尚未在该 VO 暴露，前端兜底成 undefined / "—"，
 * 待后端补字段后会自动显示真实值。
 */
type LooseDetail = AdminTeamDetail & {
  reviewMode?: 'AUTO' | 'REVIEW' | string | null;
  publicHome?: boolean | null;
  color?: string | null;
};

export function OverviewTab({ detail }: Props) {
  const isDisabled = detail.status === 'DISABLED';
  const d = detail as LooseDetail;
  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      <Card pad={16}>
        <SectionTitle>基础信息</SectionTitle>
        <KV k="名称" v={detail.name} />
        <KV k="Slug" v={`/${detail.slug}`} />
        <KV
          k="状态"
          v={<Badge tone={isDisabled ? 'danger' : 'success'} size="sm">{isDisabled ? '已禁用' : '正常'}</Badge>}
        />
        <KV k="创建于" v={detail.createdAt ?? '—'} />
        <KV k="描述" v={detail.description || '—'} />
      </Card>

      <Card pad={16}>
        <SectionTitle>Owner</SectionTitle>
        <KV k="姓名" v={detail.ownerName ?? '—'} />
        <KV k="Handle" v={detail.ownerHandle ? `@${detail.ownerHandle}` : '—'} />
      </Card>

      <Card pad={16}>
        <SectionTitle>资产</SectionTitle>
        <KV k="成员" v={detail.membersCount ?? 0} />
        <KV k="Skill" v={detail.skillsCount ?? 0} />
        <KV k="套件" v={detail.suitesCount ?? 0} />
      </Card>

      <Card pad={16}>
        <SectionTitle>团队配置（只读）</SectionTitle>
        <KV
          k="审核模式"
          v={d.reviewMode == null ? '—' : d.reviewMode === 'AUTO' ? '自动通过' : '需要审核'}
        />
        <KV k="公开首页" v={d.publicHome == null ? '—' : d.publicHome ? '是' : '否'} />
        <KV k="主色" v={d.color ?? '—'} />
        <KV
          k="Logo"
          v={detail.logoUrl
            ? <img src={detail.logoUrl} alt="" style={{ height: 28, borderRadius: 4 }} />
            : '—'}
        />
      </Card>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: TOKENS.text3, marginBottom: 10, letterSpacing: 0.3 }}>
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', fontSize: 13 }}>
      <div style={{ width: 80, color: TOKENS.text3 }}>{k}</div>
      <div style={{ flex: 1, color: TOKENS.text, wordBreak: 'break-all' }}>{v}</div>
    </div>
  );
}
