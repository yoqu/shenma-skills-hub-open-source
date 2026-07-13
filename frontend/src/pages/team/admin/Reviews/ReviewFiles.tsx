import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { Button, Card, CopyButton, EmptyState } from '@/components/ui';
import { I } from '@/components/icons';
import { reviewApi, type ReviewFileTree } from '@/api/endpoints';

const LANG_LABEL: Record<string, string> = {
  md: 'Markdown',
  json: 'JSON',
  ts: 'TypeScript',
  tsx: 'TSX',
  graphql: 'GraphQL',
  ejs: 'EJS',
  txt: 'Plain',
};


export function ReviewFiles({ reviewId }: { reviewId?: number }) {
  const query = useQuery({
    queryKey: ['review-files', reviewId],
    queryFn: () => reviewApi.files(reviewId!),
    enabled: typeof reviewId === 'number',
  });

  const data = query.data;
  const entries = data?.entries ?? [];
  const textEntries = entries.filter((e) => e.type !== 'dir' && !e.binary);
  const initial = textEntries[0]?.path ?? '';
  const [selected, setSelected] = useState(initial);

  if (!reviewId) {
    return (
      <div id="review-files">
        <Card pad={0} style={{ marginBottom: 14, padding: 24 }}>
          <EmptyState title="审核记录缺少 ID" hint="无法加载文件" />
        </Card>
      </div>
    );
  }
  if (query.isLoading) {
    return (
      <div id="review-files">
        <Card pad={0} style={{ marginBottom: 14, padding: 24 }}>
          <EmptyState icon={<I.clock size={20} />} title="正在加载文件树…" />
        </Card>
      </div>
    );
  }
  if (query.isError) {
    return (
      <div id="review-files">
        <Card pad={0} style={{ marginBottom: 14, padding: 24 }}>
          <EmptyState
            icon={<I.x size={20} />}
            title="加载文件失败"
            hint={query.error instanceof Error ? query.error.message : '请稍后重试'}
            action={
              <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
                重试
              </Button>
            }
          />
        </Card>
      </div>
    );
  }
  if (!data?.available) {
    return (
      <div id="review-files">
        <Card pad={0} style={{ marginBottom: 14, padding: 24 }}>
          <EmptyState
            icon={<I.upload size={20} />}
            title="无可预览的文件"
            hint={data?.message ?? '该版本未上传文件包'}
          />
        </Card>
      </div>
    );
  }

  const effectiveSelected = selected || textEntries[0]?.path || '';

  return (
    <Card pad={0} style={{ marginBottom: 14, overflow: 'hidden' }}>
      <div
        id="review-files"
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 14px',
          borderBottom: `1px solid ${TOKENS.borderSoft}`,
          gap: 8,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>提交包内容</span>
        <span style={{ fontSize: 11, color: TOKENS.text3 }}>
          · 共 {entries.filter((f) => f.type !== 'dir').length} 个文件 · 文本文件可点击预览
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: 360 }}>
        <FileTree data={data} selected={effectiveSelected} setSelected={setSelected} />
        <FileViewer data={data} path={effectiveSelected} />
      </div>
    </Card>
  );
}

function FileTree({
  data,
  selected,
  setSelected,
}: {
  data: ReviewFileTree;
  selected: string;
  setSelected: (p: string) => void;
}) {
  return (
    <div
      style={{
        borderRight: `1px solid ${TOKENS.borderSoft}`,
        background: TOKENS.bgAlt,
        padding: '8px 0',
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        fontSize: 12.5,
      }}
    >
      {data.entries.map((f) => {
        const isDir = f.type === 'dir';
        const depth = (f.path.match(/\//g) || []).length - (isDir ? 1 : 0);
        const name = isDir
          ? f.path.replace(/\/$/, '').split('/').pop() + '/'
          : (f.path.split('/').pop() ?? f.path);
        const active = !isDir && selected === f.path;
        const isText = !f.binary && !isDir;
        return (
          <div
            key={f.path}
            onClick={() => isText && setSelected(f.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              paddingLeft: 12 + depth * 14,
              cursor: isText ? 'pointer' : 'default',
              background: active ? '#fff' : 'transparent',
              borderLeft: active ? `3px solid ${TOKENS.primary}` : '3px solid transparent',
              color: isDir ? TOKENS.text2 : isText ? TOKENS.text : TOKENS.text3,
              fontWeight: active ? 600 : isDir ? 600 : 400,
            }}
          >
            <span style={{ width: 16, color: TOKENS.text3, textAlign: 'center', fontSize: 10, flex: '0 0 auto' }}>
              {isDir ? '📁' : f.type === 'md' ? '📄' : (
                <span style={{ color: TOKENS.primary, fontWeight: 600, fontSize: 9 }}>
                  {f.type.slice(0, 3).toUpperCase()}
                </span>
              )}
            </span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </span>
            {!isDir && (
              <span
                style={{
                  fontSize: 10,
                  color: TOKENS.text3,
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                }}
              >
                {f.size}B
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function colorizeLine(line: string, type: string): ReactNode {
  if (type === 'md') {
    if (line.startsWith('#'))
      return <span style={{ color: TOKENS.primary, fontWeight: 600 }}>{line}</span>;
    if (line.startsWith('---'))
      return <span style={{ color: TOKENS.text3 }}>{line}</span>;
    if (line.startsWith('```'))
      return <span style={{ color: TOKENS.text3 }}>{line}</span>;
    if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\. /.test(line))
      return <span style={{ color: TOKENS.text }}>{line}</span>;
    return line;
  }
  if (type === 'json') {
    return line.split(/("[^"]*")/).map((part, i) =>
      part.startsWith('"') ? (
        <span key={i} style={{ color: TOKENS.success }}>{part}</span>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  }
  if (type === 'ts' || type === 'tsx') {
    const kws =
      /\b(import|export|from|const|let|var|function|return|async|await|if|else|class|interface|type)\b/g;
    const parts = line.split(kws);
    return parts.map((p, i) =>
      /^(import|export|from|const|let|var|function|return|async|await|if|else|class|interface|type)$/.test(p) ? (
        <span key={i} style={{ color: TOKENS.primary, fontWeight: 600 }}>{p}</span>
      ) : (
        <span key={i}>{p}</span>
      ),
    );
  }
  return line;
}

function FileViewer({ data, path }: { data: ReviewFileTree; path: string }) {
  const file = data.entries.find((f) => f.path === path);
  const content = file ? data.contents[path] : undefined;

  if (!file) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: TOKENS.text3, fontSize: 12.5 }}>
        请从左侧选择一个文本文件预览
      </div>
    );
  }

  if (file.binary) {
    return (
      <div
        style={{
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          color: TOKENS.text3,
          fontSize: 12.5,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            background: TOKENS.bgGray,
            display: 'grid',
            placeItems: 'center',
            fontSize: 22,
          }}
        >
          📦
        </div>
        <div
          style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            color: TOKENS.text2,
            fontSize: 12,
          }}
        >
          {path}
        </div>
        <div>二进制文件 · {file.size} B · 不支持文本预览</div>
      </div>
    );
  }

  if (!content) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: TOKENS.text3, fontSize: 12.5 }}>
        <div
          style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            color: TOKENS.text2,
            marginBottom: 6,
          }}
        >
          {path}
        </div>
        <div>该文件超过 64KB，未加载预览。可通过"下载 zip"查看完整内容</div>
      </div>
    );
  }

  const lines = content.split('\n');
  const lang = LANG_LABEL[file.type] || file.type || 'Text';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 14px',
          borderBottom: `1px solid ${TOKENS.borderSoft}`,
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontSize: 11.5,
        }}
      >
        <span style={{ color: TOKENS.text }}>{path}</span>
        <span style={{ marginLeft: 8, color: TOKENS.text3 }}>
          · {lang} · {file.size} B · {lines.length} 行
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <CopyButton
            text={content}
            variant="secondary"
            size="sm"
            style={{ borderRadius: 4 }}
            aria-label={`复制 ${file.path} 文件内容`}
            successMessage="文件内容已复制"
          />
        </div>
      </div>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: TOKENS.bgAlt,
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontSize: 12,
          lineHeight: 1.65,
          maxHeight: 360,
        }}
      >
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex', minHeight: 19.8 }}>
            <span
              style={{
                width: 44,
                paddingRight: 12,
                textAlign: 'right',
                color: TOKENS.text3,
                userSelect: 'none',
                flex: '0 0 auto',
                borderRight: `1px solid ${TOKENS.borderSoft}`,
              }}
            >
              {i + 1}
            </span>
            <span
              style={{
                padding: '0 14px',
                whiteSpace: 'pre',
                color: TOKENS.text2,
                flex: 1,
              }}
            >
              {colorizeLine(line, file.type)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
