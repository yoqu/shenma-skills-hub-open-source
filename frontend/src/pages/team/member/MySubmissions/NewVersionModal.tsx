import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { Button, FormField, Input, Textarea } from '@/components/ui';
import { I } from '@/components/icons';
import { skillApi, type SkillParseResult } from '@/api/endpoints';
import { SkillSourceUploader } from '@/pages/create/CreateSkill/SkillSourceUploader';
import type { UploadInfo } from '@/pages/create/CreateSkill/types';
import { bumpHint, collectParseWarning, validateVersionBump } from '@/lib/skillVersionForm';

export interface NewVersionModalProps {
  /** 当前版本号，提示作者 bump */
  currentVersion: string;
  /** Skill 名字，用于标题 */
  skillName: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { version: string; changelog: string; zipUrl: string }) => void;
}

/** 发新版本的 modal — 必填上传新源文件，填写版本号和 changelog。上传器与创建 Skill 共用。 */
export function NewVersionModal({
  currentVersion,
  skillName,
  submitting,
  onClose,
  onSubmit,
}: NewVersionModalProps) {
  const [version, setVersion] = useState('');
  const [versionTouched, setVersionTouched] = useState(false);
  const [changelog, setChangelog] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [upload, setUpload] = useState<UploadInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parseResult, setParseResult] = useState<SkillParseResult | null>(null);
  const [parseWarning, setParseWarning] = useState<string | null>(null);

  const parseMutation = useMutation({
    mutationFn: (zipUrl: string) => skillApi.parseVersionZip(zipUrl),
    onSuccess: (res) => {
      setParseResult(res);
      const parsedVersion = res.parsed?.version;
      if (parsedVersion && !versionTouched) setVersion(parsedVersion);
      setParseWarning(collectParseWarning(res));
    },
    onError: () => {
      setParseResult(null);
      setParseWarning('源文件解析失败，无法自动校验 SKILL.md，可继续提交');
    },
  });

  const parsing = parseMutation.isPending;
  const busy = uploading || parsing || submitting;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  function handleUploaded(u: UploadInfo) {
    setError(null);
    setParseResult(null);
    setParseWarning(null);
    parseMutation.mutate(u.zipUrl);
  }

  function handleSetUpload(u: UploadInfo | null) {
    setUpload(u);
    if (!u) {
      setParseResult(null);
      setParseWarning(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const err = validateVersionBump({
      hasUpload: !!upload,
      version,
      currentVersion,
      changelog,
    });
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onSubmit({ version: version.trim(), changelog: changelog.trim(), zipUrl: upload!.zipUrl });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-version-title"
      onClick={() => !busy && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.45)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              padding: '15px 18px',
              borderBottom: `1px solid ${TOKENS.borderSoft}`,
              flex: '0 0 auto',
            }}
          >
            <div style={{ flex: 1 }}>
              <div id="new-version-title" style={{ fontSize: 15, fontWeight: 650 }}>
                发新版本 · {skillName}
              </div>
              <div style={{ fontSize: 12, color: TOKENS.text3, marginTop: 3 }}>
                当前版本 v{currentVersion} · 新版本审核通过后会同步到 Skill
              </div>
            </div>
            <Button variant="ghost"
              type="button"
              onClick={() => !busy && onClose()}
              aria-label="关闭"
              disabled={busy}
              style={{
                background: 'none',
                border: 'none',
                cursor: busy ? 'default' : 'pointer',
                color: TOKENS.text3,
                padding: 4,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <I.x size={16} />
            </Button>
          </div>

          {/* body */}
          <div
            style={{
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              overflowY: 'auto',
              minHeight: 0,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: TOKENS.text2,
                  marginBottom: 10,
                }}
              >
                上传新版本源文件 <span style={{ color: TOKENS.danger }}>*</span>
              </div>
              <SkillSourceUploader
                upload={upload}
                setUpload={handleSetUpload}
                onUploaded={handleUploaded}
                onUploadingChange={setUploading}
                disabled={parsing || submitting}
              />
              {parseWarning && (
                <div
                  style={{
                    marginTop: 12,
                    padding: '8px 10px',
                    fontSize: 12,
                    background: TOKENS.warningSoft,
                    border: `1px solid ${TOKENS.warning}55`,
                    borderRadius: 6,
                    color: TOKENS.warning,
                    lineHeight: 1.5,
                  }}
                >
                  {parseWarning}
                </div>
              )}
            </div>

            <FormField
              label="新版本号"
              required
              hint={
                parseResult?.parsed?.version
                  ? '已根据上传文件的 frontmatter 预填，可手动修改'
                  : '建议遵循 semver（major.minor.patch），需高于当前版本'
              }
            >
              <Input
                value={version}
                onChange={(e) => {
                  setVersion(e.target.value);
                  setVersionTouched(true);
                }}
                placeholder={`例如 ${bumpHint(currentVersion)}`}
                maxLength={32}
              />
            </FormField>

            <FormField label="变更说明 · 选填" hint="审核通过后会作为该版本的发布说明留档">
              <Textarea
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                placeholder="本次版本的主要变更，例如修复了 XX bug、新增了 XX 能力…"
                rows={4}
                maxLength={1024}
              />
            </FormField>

            {error && (
              <div
                role="alert"
                style={{
                  padding: '8px 10px',
                  fontSize: 12,
                  background: TOKENS.dangerSoft,
                  border: `1px solid ${TOKENS.danger}33`,
                  borderRadius: 6,
                  color: TOKENS.danger,
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '12px 18px',
              borderTop: `1px solid ${TOKENS.borderSoft}`,
              background: TOKENS.bgAlt,
              flex: '0 0 auto',
            }}
          >
            <Button type="button" variant="ghost" size="md" onClick={() => !busy && onClose()} disabled={busy}>
              取消
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={busy}>
              {submitting ? '提交中…' : parsing ? '解析中…' : uploading ? '上传中…' : '提交审核'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
