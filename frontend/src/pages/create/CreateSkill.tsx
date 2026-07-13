import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import { Button, Card } from '@/components/ui';
import { TopBar, TeamSidebar } from '@/components/chrome';
import { useCurrentTeam } from '@/api/data';
import { DashTopBar } from '@/components/ui';
import { skillApi } from '@/api/endpoints';
import { Stepper, type StepDef } from './CreateSkill/Stepper';
import { Step1Upload } from './CreateSkill/Step1';
import { Step2Parse } from './CreateSkill/Step2';
import { Step3Meta } from './CreateSkill/Step3';
import { Step4Submit } from './CreateSkill/Step4';
import type { SkillMeta, SkillParseResult, UploadInfo } from './CreateSkill/types';

const STEPS: StepDef[] = [
  { id: 1, label: '上传压缩包', hint: '拖入 SKILL.zip' },
  { id: 2, label: '解析与校验', hint: '检查 SKILL.md' },
  { id: 3, label: '确认元数据', hint: '可手动调整' },
  { id: 4, label: '可见性与提交', hint: '根据审核模式去向' },
];

function emptyMeta(team: string): SkillMeta {
  return {
    name: '',
    slug: '',
    version: '',
    description: '',
    descriptionMd: '',
    tags: [],
    category: '',
    visibility: 'TEAM_PRIVATE',
    team,
  };
}

export default function CreateSkill() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const { teamId, teamSlug } = useCurrentTeam();
  const [step, setStep] = useState<number>(1);
  const [upload, setUpload] = useState<UploadInfo | null>(null);
  const [parseResult, setParseResult] = useState<SkillParseResult | null>(null);
  const [meta, setMeta] = useState<SkillMeta>(() => emptyMeta(teamSlug ?? ''));

  // teamSlug 是异步加载的；在解析到值之前避免 meta.team 锁死为空字符串。
  useEffect(() => {
    if (teamSlug && meta.team !== teamSlug) {
      setMeta((m) => ({ ...m, team: teamSlug }));
    }
  }, [teamSlug, meta.team]);

  const saveDraft = useMutation({
    mutationFn: () => {
      if (!teamId) throw new Error('当前未选中团队');
      const langs = parseResult?.parsed?.langs?.filter((l): l is string => !!l) ?? [];
      return skillApi.saveDraft({
        name: meta.name,
        slug: meta.slug,
        shortDesc: meta.description,
        descriptionMd: meta.descriptionMd,
        cat: meta.category,
        visibility: meta.visibility,
        version: meta.version,
        teamId,
        icon: meta.name.slice(0, 1).toUpperCase() || 'S',
        tags: meta.tags,
        langs,
        files: upload ? [{ path: upload.fileName, size: upload.size }] : undefined,
        fileCount: parseResult?.fileCount,
        zipUrl: upload?.zipUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-drafts'] });
      // MySubmissions（/team/mine）的草稿 tab 读的是 reviews 队列，必须一起失效
      queryClient.invalidateQueries({ queryKey: ['reviews', teamId] });
      nav('/team/mine');
    },
  });

  // 后端 cat / version 字段都是 NOT NULL,有效草稿至少要走完到 Step3 才可保存
  const canSaveDraft =
    !!teamId &&
    !!meta.name.trim() &&
    !!meta.slug.trim() &&
    !!meta.category &&
    !!meta.version.trim() &&
    !!meta.description.trim();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: TOKENS.bgAlt,
      }}
    >
      <TopBar active="myteam" authed />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <TeamSidebar active="skills" />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <DashTopBar
            title="创建 Skill"
            hint={`提交一个新的 Skill 到团队 · 步骤 ${step} / 4`}
            actions={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => saveDraft.mutate()}
                disabled={saveDraft.isPending || !canSaveDraft}
                title={canSaveDraft ? undefined : '请先在第 3 步填好 名称 / slug / 分类 / 版本 / 描述'}
              >
                {saveDraft.isPending ? '保存中…' : '保存为草稿'}
              </Button>
            }
          />
          <div style={{ padding: '24px 32px 40px', overflow: 'auto', maxWidth: 920 }}>
            <Stepper steps={STEPS} current={step} setStep={setStep} />
            {saveDraft.isError && (
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: TOKENS.dangerSoft,
                  border: `1px solid ${TOKENS.danger}33`,
                  color: TOKENS.danger,
                  fontSize: 12.5,
                }}
              >
                保存草稿失败:{' '}
                {(saveDraft.error as Error | undefined)?.message ?? '请稍后重试'}
              </div>
            )}
            <Card pad={24} style={{ marginTop: 20 }}>
              {step === 1 && (
                <Step1Upload
                  upload={upload}
                  setUpload={(u) => {
                    setUpload(u);
                    // 新上传打开新一轮解析
                    setParseResult(null);
                  }}
                  onNext={() => setStep(2)}
                  onCancel={() => nav(-1)}
                />
              )}
              {step === 2 && (
                <Step2Parse
                  upload={upload}
                  parseResult={parseResult}
                  setParseResult={setParseResult}
                  onNext={() => setStep(3)}
                  onBack={() => setStep(1)}
                />
              )}
              {step === 3 && (
                <Step3Meta
                  meta={meta}
                  setMeta={setMeta}
                  parseResult={parseResult}
                  onNext={() => setStep(4)}
                  onBack={() => setStep(2)}
                />
              )}
              {step === 4 && (
                <Step4Submit
                  meta={meta}
                  setMeta={setMeta}
                  upload={upload}
                  parseResult={parseResult}
                  onBack={() => setStep(3)}
                />
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
