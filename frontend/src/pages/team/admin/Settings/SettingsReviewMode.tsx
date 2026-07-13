import type { ComponentType } from 'react';
import { TOKENS } from '@/lib/tokens';
import { Badge, Button, Card, SectionHeader } from '@/components/ui';
import { I, type IconProps } from '@/components/icons';

export type ReviewMode = 'REVIEW_REQUIRED' | 'DIRECT_PUBLISH';

interface ModeOpt {
  id: ReviewMode;
  name: string;
  icon: ComponentType<IconProps>;
  desc: string;
  tone: string;
  bg: string;
}

const OPTIONS: ModeOpt[] = [
  {
    id: 'REVIEW_REQUIRED',
    name: '需要审核',
    icon: I.shield,
    desc: 'Member 提交后进入 PENDING_REVIEW。Owner/Admin 提交时可直接通过。',
    tone: TOKENS.primary,
    bg: TOKENS.primarySoft,
  },
  {
    id: 'DIRECT_PUBLISH',
    name: '直接发布',
    icon: I.bolt,
    desc: 'Member 提交后直接变为 APPROVED。Owner/Admin 仍可后续下架、归档。',
    tone: TOKENS.warning,
    bg: '#FFFBEB',
  },
];

export interface SettingsReviewModeProps {
  mode: ReviewMode;
  setMode: (m: ReviewMode) => void;
}

export function SettingsReviewMode({ mode, setMode }: SettingsReviewModeProps) {
  return (
    <Card pad={20} style={{ marginBottom: 16 }}>
      <SectionHeader
        title="审核模式"
        hint="决定 Member 提交 Skill 后的去向 · 只影响之后的新提交"
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {OPTIONS.map((opt) => {
          const Ico = opt.icon;
          const active = mode === opt.id;
          return (
            <Button variant="ghost"
              key={opt.id}
              type="button"
              onClick={() => setMode(opt.id)}
              style={{
                padding: 16,
                height: 'auto',
                minHeight: 120,
                borderRadius: 10,
                cursor: 'pointer',
                background: active ? opt.bg : '#fff',
                border: `1.5px solid ${active ? opt.tone : TOKENS.border}`,
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                justifyContent: 'flex-start',
                gap: 10,
                fontFamily: 'inherit',
                whiteSpace: 'normal',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: opt.tone,
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Ico size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.name}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: TOKENS.text3,
                      fontFamily: 'monospace',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {opt.id}
                  </div>
                </div>
                {active && (
                  <Badge tone="primary" size="sm">
                    当前
                  </Badge>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: TOKENS.text2, lineHeight: 1.55 }}>
                {opt.desc}
              </div>
            </Button>
          );
        })}
      </div>
      <ReviewModeDiagram mode={mode} />
    </Card>
  );
}

function ReviewModeDiagram({ mode }: { mode: ReviewMode }) {
  const isReview = mode === 'REVIEW_REQUIRED';
  return (
    <div
      style={{
        padding: 18,
        background: TOKENS.bgAlt,
        borderRadius: 10,
        border: `1px solid ${TOKENS.borderSoft}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: TOKENS.text3,
          marginBottom: 12,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        当前流程效果预览
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 12,
          flexWrap: 'wrap',
        }}
      >
        <FlowBox icon={I.user} label="Member" sub="提交 Skill" color={TOKENS.text2} />
        <FlowArrow />
        {isReview ? (
          <>
            <FlowBox
              icon={I.clock}
              label="PENDING_REVIEW"
              sub="进入审核队列"
              color={TOKENS.warning}
              highlight
            />
            <FlowArrow />
            <FlowBox icon={I.users} label="Owner / Admin" sub="审核决定" />
            <FlowArrow />
            <FlowBox
              icon={I.check}
              label="APPROVED"
              sub="发布"
              color={TOKENS.success}
            />
          </>
        ) : (
          <>
            <FlowBox
              icon={I.bolt}
              label="DIRECT_PUBLISH"
              sub="自动通过"
              color={TOKENS.warning}
              highlight
            />
            <FlowArrow />
            <FlowBox
              icon={I.check}
              label="APPROVED"
              sub="立即发布"
              color={TOKENS.success}
            />
          </>
        )}
      </div>
      <div
        style={{
          marginTop: 14,
          fontSize: 12,
          color: TOKENS.text2,
          lineHeight: 1.6,
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start',
        }}
      >
        <I.sparkles
          size={13}
          style={{ color: TOKENS.primary, marginTop: 2, flex: '0 0 auto' }}
        />
        <div>
          {isReview ? (
            <>
              已有 <b>3 个</b> Skill 在队列中等待。切换为「直接发布」后,新的提交将
              <b style={{ color: TOKENS.warning }}>跳过</b>审核队列,直接上线;队列中现有项不受影响。
            </>
          ) : (
            <>
              切换为「直接发布」后,Member 提交的 Skill 会立即上线。你仍然可以随时下架、归档或拒绝任何 Skill。
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface FlowBoxProps {
  icon: ComponentType<IconProps>;
  label: string;
  sub: string;
  color?: string;
  highlight?: boolean;
}

function FlowBox({
  icon: Ico,
  label,
  sub,
  color = TOKENS.text2,
  highlight,
}: FlowBoxProps) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 116,
        padding: 10,
        background: '#fff',
        border: `1.5px solid ${highlight ? color : TOKENS.border}`,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        boxShadow: highlight ? `0 0 0 4px ${color}15` : 'none',
      }}
    >
      <Ico size={14} style={{ color }} />
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color,
          fontFamily: 'monospace',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 10.5, color: TOKENS.text3 }}>{sub}</div>
    </div>
  );
}

function FlowArrow() {
  return <I.chevR size={14} style={{ color: TOKENS.text3, flex: '0 0 auto' }} />;
}
