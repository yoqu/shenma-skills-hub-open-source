import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { Button, Divider, Textarea } from '@/components/ui';
import { I } from '@/components/icons';
import { skillApi } from '@/api/endpoints';
import type { UploadInfo, UploadKind } from './types';

const MAX_ZIP_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_MD_BYTES = 256 * 1024; // 256 KB

const codeStyle = {
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 11,
};

const TEMPLATE_TEXT = `---
name: my-skill
version: 0.1.0
description: one-line description
category: dev
tags: [demo]
---

# My Skill

简要说明这个 skill 做什么,如何使用。
`;

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function uploadKindLabel(kind: UploadKind): string {
  return kind === 'zip' ? '压缩包' : kind === 'md' ? 'SKILL.md 文件' : '粘贴的 SKILL.md';
}

function validateFile(file: File, kind: 'zip' | 'md'): string | null {
  const name = file.name.toLowerCase();
  if (kind === 'zip') {
    if (!name.endsWith('.zip')) return '只支持 .zip 压缩包';
    if (file.size > MAX_ZIP_BYTES) return `文件超过 20 MB 限制（当前 ${formatSize(file.size)}）`;
  } else {
    if (!name.endsWith('.md')) return '只支持 .md 文件';
    if (file.size > MAX_MD_BYTES) return `SKILL.md 不能超过 256 KB（当前 ${formatSize(file.size)}）`;
  }
  if (file.size === 0) return '文件为空';
  return null;
}

function UploadHint({ kind }: { kind: UploadKind }) {
  return (
    <div
      style={{
        padding: 14,
        background: TOKENS.bgAlt,
        borderRadius: 8,
        fontSize: 12,
        color: TOKENS.text2,
        lineHeight: 1.7,
      }}
    >
      {kind === 'zip' && (
        <>
          <b style={{ color: TOKENS.text }}>压缩包要求</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20, color: TOKENS.text2 }}>
            <li>
              根目录必须包含 <code style={{ ...codeStyle, color: TOKENS.primary }}>SKILL.md</code>,
              首部为 YAML frontmatter (name / version / description 必填)
            </li>
            <li>
              建议附 <code style={codeStyle}>README.md</code>、<code style={codeStyle}>LICENSE</code>
            </li>
            <li>
              请勿包含 <code style={codeStyle}>node_modules/</code>、
              <code style={codeStyle}>.git/</code> 等冗余目录
            </li>
            <li>单包 ≤ 20 MB</li>
          </ul>
        </>
      )}
      {kind === 'md' && (
        <>
          <b style={{ color: TOKENS.text }}>单文件 Skill</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20, color: TOKENS.text2 }}>
            <li>上传一个 SKILL.md (≤ 256 KB),内含 YAML frontmatter 与正文</li>
            <li>服务端会自动把它包成 zip 进入后续审核 / 下载链路</li>
          </ul>
        </>
      )}
      {kind === 'text' && (
        <>
          <b style={{ color: TOKENS.text }}>粘贴 SKILL.md</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20, color: TOKENS.text2 }}>
            <li>
              首行应为 <code style={{ ...codeStyle, color: TOKENS.primary }}>---</code>,
              中间是 YAML frontmatter,再以 <code style={codeStyle}>---</code> 结束
            </li>
            <li>frontmatter 之后是任意 Markdown 正文</li>
          </ul>
        </>
      )}
    </div>
  );
}

export interface SkillSourceUploaderProps {
  upload: UploadInfo | null;
  setUpload: (u: UploadInfo | null) => void;
  /** 一次新的上传成功后触发（用于上层解析 / 版本号回填）。 */
  onUploaded?: (u: UploadInfo) => void;
  /** 上传请求进行中状态变化时通知上层。 */
  onUploadingChange?: (uploading: boolean) => void;
  /** 上层处于忙碌（解析 / 提交）时禁用交互。 */
  disabled?: boolean;
  /** 是否展示帮助说明块（向导展示；弹窗可省略）。 */
  showHint?: boolean;
}

/**
 * Skill 源文件上传器：压缩包 / 单文件 SKILL.md / 粘贴文本三种入口，
 * 后端三种入口都会合成 zip。创建向导与「发新版本」弹窗共用此组件，保证逻辑与样式一致。
 */
export function SkillSourceUploader({
  upload,
  setUpload,
  onUploaded,
  onUploadingChange,
  disabled = false,
  showHint = false,
}: SkillSourceUploaderProps) {
  const [mode, setMode] = useState<UploadKind>(upload?.kind ?? 'zip');
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const mdInputRef = useRef<HTMLInputElement | null>(null);

  const commit = (info: UploadInfo) => {
    setUpload(info);
    onUploaded?.(info);
  };

  const uploadZip = useMutation({
    mutationFn: async (file: File) => ({ res: await skillApi.uploadVersionZip(file), file }),
    onSuccess: ({ res, file }) =>
      commit({ kind: 'zip', fileName: file.name, size: file.size, zipUrl: res.zipUrl, url: res.url }),
  });
  const uploadMd = useMutation({
    mutationFn: async (file: File) => ({ res: await skillApi.uploadVersionMd(file), file }),
    onSuccess: ({ res, file }) =>
      commit({ kind: 'md', fileName: file.name, size: file.size, zipUrl: res.zipUrl, url: res.url }),
  });
  const uploadText = useMutation({
    mutationFn: async (content: string) => ({
      res: await skillApi.uploadVersionText(content),
      size: new Blob([content]).size,
    }),
    onSuccess: ({ res, size }) =>
      commit({ kind: 'text', fileName: 'SKILL.md', size, zipUrl: res.zipUrl, url: res.url }),
  });

  const isPending = uploadZip.isPending || uploadMd.isPending || uploadText.isPending;
  const inert = isPending || disabled;
  const mutationError =
    (uploadZip.isError && (uploadZip.error as Error).message) ||
    (uploadMd.isError && (uploadMd.error as Error).message) ||
    (uploadText.isError && (uploadText.error as Error).message) ||
    null;
  const lastError = localError ?? mutationError;

  useEffect(() => {
    onUploadingChange?.(isPending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending]);

  const handleZip = (file: File | undefined | null) => {
    setLocalError(null);
    if (!file) return;
    const err = validateFile(file, 'zip');
    if (err) {
      setLocalError(err);
      return;
    }
    uploadZip.mutate(file);
  };

  const handleMd = (file: File | undefined | null) => {
    setLocalError(null);
    if (!file) return;
    const err = validateFile(file, 'md');
    if (err) {
      setLocalError(err);
      return;
    }
    uploadMd.mutate(file);
  };

  const submitText = () => {
    setLocalError(null);
    const trimmed = pasteText.trim();
    if (!trimmed) {
      setLocalError('请粘贴 SKILL.md 内容');
      return;
    }
    if (new Blob([pasteText]).size > MAX_MD_BYTES) {
      setLocalError('内容超过 256 KB 限制');
      return;
    }
    uploadText.mutate(pasteText);
  };

  const reset = () => {
    setUpload(null);
    setLocalError(null);
    setPasteText('');
    uploadZip.reset();
    uploadMd.reset();
    uploadText.reset();
    if (zipInputRef.current) zipInputRef.current.value = '';
    if (mdInputRef.current) mdInputRef.current.value = '';
  };

  const switchMode = (m: UploadKind) => {
    if (inert) return;
    if (upload && upload.kind !== m) {
      reset();
    }
    setMode(m);
    setLocalError(null);
  };

  // ---------- uploaded view ----------
  if (upload && !isPending) {
    return (
      <div>
        <div
          style={{
            padding: 18,
            background: TOKENS.successSoft,
            border: `1px solid ${TOKENS.success}33`,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#fff',
              border: `1px solid ${TOKENS.success}55`,
              color: TOKENS.success,
              display: 'grid',
              placeItems: 'center',
              flex: '0 0 auto',
            }}
          >
            <I.check size={20} stroke={2.5} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, wordBreak: 'break-all' }}>
              {upload.fileName}
            </div>
            <div style={{ fontSize: 12, color: TOKENS.text3, marginTop: 2 }}>
              {uploadKindLabel(upload.kind)} · {formatSize(upload.size)} · 已合成 zip
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={reset} disabled={disabled}>
            重新选择
          </Button>
        </div>
        {showHint && (
          <>
            <Divider style={{ margin: '20px 0' }} />
            <UploadHint kind={upload.kind} />
          </>
        )}
      </div>
    );
  }

  // ---------- mode picker + entry ----------
  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          padding: 4,
          background: TOKENS.bgGray,
          borderRadius: 10,
        }}
      >
        {(
          [
            { id: 'zip' as const, label: '上传压缩包', hint: '.zip 完整包' },
            { id: 'md' as const, label: '上传 SKILL.md', hint: '单文件' },
            { id: 'text' as const, label: '粘贴文本', hint: '直接编辑' },
          ]
        ).map((opt) => {
          const active = mode === opt.id;
          return (
            <Button variant="ghost"
              key={opt.id}
              type="button"
              onClick={() => switchMode(opt.id)}
              disabled={inert}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                cursor: inert ? 'default' : 'pointer',
                textAlign: 'center',
                fontFamily: 'inherit',
                background: active ? '#fff' : 'transparent',
                color: active ? TOKENS.text : TOKENS.text2,
                fontWeight: active ? 600 : 500,
                boxShadow: active ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
              }}
            >
              <div style={{ fontSize: 13 }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 2 }}>{opt.hint}</div>
            </Button>
          );
        })}
      </div>

      {/* hidden file inputs */}
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        style={{ display: 'none' }}
        onChange={(e) => {
          handleZip(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={mdInputRef}
        type="file"
        accept=".md,text/markdown,text/plain"
        style={{ display: 'none' }}
        onChange={(e) => {
          handleMd(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {mode === 'zip' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!inert) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (inert) return;
            handleZip(e.dataTransfer.files?.[0]);
          }}
          style={{
            padding: '48px 24px',
            borderRadius: 12,
            textAlign: 'center',
            border: `2px dashed ${dragging ? TOKENS.primary : TOKENS.border}`,
            background: dragging ? TOKENS.primarySoft : TOKENS.bgAlt,
            opacity: inert ? 0.7 : 1,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto 14px',
              borderRadius: 12,
              background: '#fff',
              border: `1px solid ${TOKENS.border}`,
              color: TOKENS.primary,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <I.arrowUp size={24} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            {uploadZip.isPending ? '正在上传…' : '把 SKILL.zip 拖到这里'}
          </div>
          {!uploadZip.isPending && (
            <>
              <div style={{ fontSize: 12, color: TOKENS.text3, marginBottom: 14 }}>或</div>
              <Button
                variant="primary"
                size="md"
                onClick={() => zipInputRef.current?.click()}
                disabled={inert}
              >
                从本地选择压缩包
              </Button>
            </>
          )}
        </div>
      )}

      {mode === 'md' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!inert) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (inert) return;
            handleMd(e.dataTransfer.files?.[0]);
          }}
          style={{
            padding: '48px 24px',
            borderRadius: 12,
            textAlign: 'center',
            border: `2px dashed ${dragging ? TOKENS.primary : TOKENS.border}`,
            background: dragging ? TOKENS.primarySoft : TOKENS.bgAlt,
            opacity: inert ? 0.7 : 1,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto 14px',
              borderRadius: 12,
              background: '#fff',
              border: `1px solid ${TOKENS.border}`,
              color: TOKENS.primary,
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            .md
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            {uploadMd.isPending ? '正在上传…' : '拖入 SKILL.md 或点击选择'}
          </div>
          {!uploadMd.isPending && (
            <>
              <div style={{ fontSize: 12, color: TOKENS.text3, marginBottom: 14 }}>
                单文件 skill,服务端会自动合成 zip
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={() => mdInputRef.current?.click()}
                disabled={inert}
              >
                从本地选择 .md
              </Button>
            </>
          )}
        </div>
      )}

      {mode === 'text' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: TOKENS.text3 }}>
              {pasteText.length} 字符 · {formatSize(new Blob([pasteText]).size)}
            </span>
            <span style={{ flex: 1 }} />
            <Button variant="ghost"
              type="button"
              onClick={() => setPasteText(TEMPLATE_TEXT)}
              disabled={inert || !!pasteText.trim()}
              style={{
                background: 'none',
                border: 0,
                color: inert || pasteText.trim() ? TOKENS.text3 : TOKENS.primary,
                fontSize: 11.5,
                cursor: inert || pasteText.trim() ? 'default' : 'pointer',
                padding: 0,
              }}
            >
              填入模板
            </Button>
          </div>
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            disabled={inert}
            placeholder={'---\nname: my-skill\nversion: 0.1.0\ndescription: ...\n---\n\n# 正文'}
            style={{
              minHeight: 240,
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: 13,
              lineHeight: 1.55,
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <span style={{ flex: 1 }} />
            <Button
              variant="primary"
              size="md"
              onClick={submitText}
              disabled={inert || !pasteText.trim()}
            >
              {uploadText.isPending ? '保存中…' : '保存并解析'}
            </Button>
          </div>
        </div>
      )}

      {lastError && (
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
          {lastError}
        </div>
      )}

      {showHint && (
        <div style={{ marginTop: 20 }}>
          <UploadHint kind={mode} />
        </div>
      )}
    </div>
  );
}
