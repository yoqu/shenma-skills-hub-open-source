import { useEffect, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { Button, SectionHeader } from '@/components/ui';
import { I } from '@/components/icons';
import { skillApi } from '@/api/endpoints';
import type { SkillParseCheck, SkillParseResult, UploadInfo } from './types';

function statusVisual(status: SkillParseCheck['status']): { tone: string; mark: ReactNode } {
  if (status === 'pass') return { tone: TOKENS.success, mark: <I.check size={11} stroke={2.5} /> };
  if (status === 'warn') return { tone: TOKENS.warning, mark: '!' };
  return { tone: TOKENS.danger, mark: '×' };
}

export interface Step2Props {
  upload: UploadInfo | null;
  parseResult: SkillParseResult | null;
  setParseResult: (r: SkillParseResult | null) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step2Parse({ upload, parseResult, setParseResult, onNext, onBack }: Step2Props) {
  const parse = useMutation({
    mutationFn: (zipUrl: string) => skillApi.parseVersionZip(zipUrl),
    onSuccess: (res) => setParseResult(res),
  });

  // 进入 Step2 时自动触发解析(没有结果且没在进行中)
  useEffect(() => {
    if (upload && !parseResult && !parse.isPending && !parse.isError) {
      parse.mutate(upload.zipUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upload?.zipUrl]);

  if (!upload) {
    return (
      <div>
        <SectionHeader title="解析与校验" hint="尚未上传压缩包" />
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: TOKENS.dangerSoft,
            border: `1px solid ${TOKENS.danger}33`,
            color: TOKENS.danger,
            fontSize: 12.5,
          }}
        >
          请回到上一步上传 SKILL.zip。
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <Button variant="ghost" size="md" onClick={onBack}>
            ← 返回
          </Button>
        </div>
      </div>
    );
  }

  if (parse.isPending && !parseResult) {
    return (
      <div>
        <SectionHeader title="解析与校验" hint="正在分析压缩包内容…" />
        <div
          style={{
            padding: '32px 12px',
            textAlign: 'center',
            color: TOKENS.text3,
            fontSize: 13,
            border: `1px dashed ${TOKENS.border}`,
            borderRadius: 8,
          }}
        >
          解析中,请稍候…
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <Button variant="ghost" size="md" onClick={onBack}>
            ← 返回
          </Button>
        </div>
      </div>
    );
  }

  if (parse.isError && !parseResult) {
    return (
      <div>
        <SectionHeader title="解析与校验" hint="解析失败" />
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: TOKENS.dangerSoft,
            border: `1px solid ${TOKENS.danger}33`,
            color: TOKENS.danger,
            fontSize: 12.5,
          }}
        >
          {(parse.error as Error).message}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <Button variant="ghost" size="md" onClick={onBack}>
            ← 返回
          </Button>
          <span style={{ flex: 1 }} />
          <Button
            variant="primary"
            size="md"
            onClick={() => parse.mutate(upload.zipUrl)}
            disabled={parse.isPending}
          >
            重试解析
          </Button>
        </div>
      </div>
    );
  }

  if (!parseResult) {
    return null;
  }

  const checks = parseResult.checks ?? [];
  const ok = parseResult.ok;

  return (
    <div>
      <SectionHeader
        title="解析与校验"
        hint={
          parseResult.hasFrontmatter
            ? '已自动解析 SKILL.md frontmatter,下一步将预填元数据'
            : '基础结构已检查,下一步请手动填写元数据'
        }
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {checks.map((c, i) => {
          const { tone, mark } = statusVisual(c.status);
          return (
            <div
              key={`${c.name}-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                border: `1px solid ${TOKENS.borderSoft}`,
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: tone,
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  flex: '0 0 auto',
                }}
              >
                {mark}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                <div style={{ fontSize: 11.5, color: TOKENS.text3, marginTop: 2 }}>{c.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
      {ok ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: TOKENS.successSoft,
            border: `1px solid ${TOKENS.success}33`,
            borderRadius: 8,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            fontSize: 12.5,
          }}
        >
          <I.check size={14} style={{ color: TOKENS.success, marginTop: 2, flex: '0 0 auto' }} />
          <div style={{ color: TOKENS.successDeep, lineHeight: 1.6 }}>
            <b>校验通过。</b> sha256{' '}
            <code style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
              {parseResult.sha256.slice(0, 12)}…
            </code>{' '}
            · {parseResult.fileCount} 个文件
          </div>
        </div>
      ) : (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: TOKENS.warningSoft,
            border: `1px solid ${TOKENS.warning}55`,
            borderRadius: 8,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            fontSize: 12.5,
          }}
        >
          <I.shield
            size={14}
            style={{ color: TOKENS.warning, marginTop: 2, flex: '0 0 auto' }}
          />
          <div style={{ color: TOKENS.text2, lineHeight: 1.6 }}>
            有未通过的校验项 —— 你也可以直接进入下一步,在表单里手动补全缺失字段后再提交。
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <Button variant="ghost" size="md" onClick={onBack}>
          ← 返回
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={() => parse.mutate(upload.zipUrl)}
          disabled={parse.isPending}
        >
          {parse.isPending ? '重新解析中…' : '重新解析'}
        </Button>
        <span style={{ flex: 1 }} />
        <Button
          variant="primary"
          size="md"
          onClick={onNext}
          icon={<I.chevR size={12} />}
        >
          {ok ? '下一步 · 确认元数据' : '下一步 · 手动补全'}
        </Button>
      </div>
    </div>
  );
}
