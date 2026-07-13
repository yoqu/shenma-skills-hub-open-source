import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { skillApi, type SkillParseResult } from '@/api/endpoints';
import { useCurrentTeam } from '@/api/data';
import { TOKENS } from '@/lib/tokens';
import { Button, FormField, Input, Textarea, toast } from '@/components/ui';
import { I } from '@/components/icons';
import { SkillSourceUploader } from '@/pages/create/CreateSkill/SkillSourceUploader';
import type { UploadInfo } from '@/pages/create/CreateSkill/types';
import { bumpHint, collectParseWarning, validateVersionBump } from '@/lib/skillVersionForm';
import type { Skill } from '@/mocks/skills';

interface AdminSubmitVersionModalProps {
  skill: Skill;
  onClose: () => void;
}

export function AdminSubmitVersionModal({ skill, onClose }: AdminSubmitVersionModalProps) {
  const { teamId, role } = useCurrentTeam();
  const qc = useQueryClient();
  const [upload, setUpload] = useState<UploadInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [version, setVersion] = useState('');
  const [versionTouched, setVersionTouched] = useState(false);
  const [changelog, setChangelog] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<SkillParseResult | null>(null);
  const [parseWarning, setParseWarning] = useState<string | null>(null);

  const isAdmin = role === 'Owner' || role === 'Admin';

  const parse = useMutation({
    mutationFn: (key: string) => skillApi.parseVersionZip(key),
    onSuccess: (res) => {
      setParseResult(res);
      if (res.parsed?.version && !versionTouched) setVersion(res.parsed.version);
      setParseWarning(collectParseWarning(res));
    },
    onError: () => {
      setParseResult(null);
      setParseWarning('源文件解析失败，无法自动校验 SKILL.md，可继续提交');
    },
  });

  const submit = useMutation({
    mutationFn: () =>
      skillApi.submitVersion(skill.id!, {
        version: version.trim(),
        changelog: changelog.trim(),
        zipUrl: upload!.zipUrl,
      }),
    onSuccess: (res) => {
      toast({ kind: 'success', message: res.pendingReview ? '新版本已提交审核' : '新版本已发布' });
      qc.invalidateQueries({ queryKey: ['team-skills', teamId] });
      qc.invalidateQueries({ queryKey: ['skills', skill.slug] });
      qc.invalidateQueries({ queryKey: ['skill-versions', skill.slug] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : '提交失败'),
  });

  const busy = uploading || parse.isPending || submit.isPending;

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
    parse.mutate(u.zipUrl);
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
    if (!skill.id) return setError('缺少 Skill ID，无法提交');
    const err = validateVersionBump({
      hasUpload: !!upload,
      version,
      currentVersion: skill.version,
      changelog,
      requireChangelog: true,
    });
    if (err) return setError(err);
    setError(null);
    submit.mutate();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-submit-version-title"
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
          maxHeight: '88vh',
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
              <div id="admin-submit-version-title" style={{ fontSize: 15, fontWeight: 650 }}>
                提交新版本 · {skill.name}
              </div>
              <div style={{ fontSize: 12, color: TOKENS.text3, marginTop: 3 }}>
                当前版本 v{skill.version}
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
            <div
              style={{
                padding: 10,
                border: `1px solid ${isAdmin ? TOKENS.success : TOKENS.warning}55`,
                background: isAdmin ? TOKENS.successSoft : TOKENS.warningSoft,
                borderRadius: 8,
                fontSize: 12.5,
                color: TOKENS.text2,
                lineHeight: 1.5,
              }}
            >
              {isAdmin
                ? '你是团队管理员，本次更新会绕过审核并直接发布。'
                : '非管理员提交后会按团队审核设置决定是否进入审核。'}
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: TOKENS.text2, marginBottom: 10 }}>
                上传新版本源文件 <span style={{ color: TOKENS.danger }}>*</span>
              </div>
              <SkillSourceUploader
                upload={upload}
                setUpload={handleSetUpload}
                onUploaded={handleUploaded}
                onUploadingChange={setUploading}
                disabled={parse.isPending || submit.isPending}
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
                placeholder={`例如 ${bumpHint(skill.version)}`}
                maxLength={32}
              />
            </FormField>

            <FormField label="变更说明" required hint="本次版本的主要变更，发布后留档">
              <Textarea
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                placeholder="修复了 XX bug、新增了 XX 能力…"
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
              {submit.isPending
                ? '提交中…'
                : parse.isPending
                ? '解析中…'
                : uploading
                ? '上传中…'
                : '提交新版本'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
