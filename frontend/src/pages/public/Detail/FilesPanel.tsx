import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Folder, FolderOpen } from 'lucide-react';
import { Button, Card, EmptyState } from '@/components/ui';
import { skillApi } from '@/api/endpoints';
import { TOKENS } from '@/lib/tokens';
import { I } from '@/components/icons';
import { buildFileTree, formatBytes, type FileTreeNode } from './fileTree';

export function FilesPanel({
  slug,
  version,
  enabled,
}: {
  slug: string;
  version: string;
  enabled: boolean;
}) {
  const query = useQuery({
    queryKey: ['skill-version-files', slug, version],
    queryFn: () => skillApi.versionFiles(slug, version),
    enabled: enabled && Boolean(slug) && Boolean(version),
    staleTime: 60_000,
  });

  if (query.isLoading) {
    return (
      <Card pad={20}>
        <EmptyState icon={<I.clock size={20} />} title="正在加载文件清单…" />
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Card pad={20}>
        <EmptyState
          icon={<I.x size={20} />}
          title="文件清单加载失败"
          hint="请稍后重试，或检查网络连接"
          action={
            <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
              重试
            </Button>
          }
        />
      </Card>
    );
  }

  const entries = query.data ?? [];
  if (entries.length === 0) {
    return (
      <Card pad={20}>
        <EmptyState
          icon={<I.code size={20} />}
          title="该版本暂无文件"
          hint="作者上传后会显示完整文件清单"
        />
      </Card>
    );
  }

  const tree = buildFileTree(entries);
  const totalSize = entries.reduce((sum, e) => sum + Math.max(0, e.size ?? 0), 0);

  return (
    <Card pad={16}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          fontSize: 12,
          color: TOKENS.text3,
          marginBottom: 10,
          padding: '0 4px',
          gap: 8,
        }}
      >
        <span>共 {entries.length} 个文件</span>
        <span>·</span>
        <span>总大小 {formatBytes(totalSize)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {tree.map((node) => (
          <TreeRow key={node.path} node={node} depth={0} />
        ))}
      </div>
    </Card>
  );
}

function TreeRow({ node, depth }: { node: FileTreeNode; depth: number }) {
  const [open, setOpen] = useState(true);

  if (node.isDir) {
    return (
      <>
        <div
          onClick={() => setOpen((o) => !o)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpen((o) => !o);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 6px',
            paddingLeft: 6 + depth * 16,
            cursor: 'pointer',
            borderRadius: 4,
            color: TOKENS.text,
            fontSize: 13,
            userSelect: 'none',
          }}
        >
          {open ? (
            <FolderOpen size={14} style={{ color: TOKENS.text2, flexShrink: 0 }} />
          ) : (
            <Folder size={14} style={{ color: TOKENS.text2, flexShrink: 0 }} />
          )}
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.name}
          </span>
          <span style={{ color: TOKENS.text3, fontSize: 11.5 }}>{formatBytes(node.size)}</span>
        </div>
        {open && node.children.map((child) => (
          <TreeRow key={child.path} node={child} depth={depth + 1} />
        ))}
      </>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 6px',
        paddingLeft: 6 + depth * 16,
        color: TOKENS.text,
        fontSize: 13,
      }}
    >
      <I.code size={14} style={{ color: TOKENS.text3, flexShrink: 0 }} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--font-mono), monospace',
        }}
      >
        {node.name}
      </span>
      <span style={{ color: TOKENS.text3, fontSize: 11.5 }}>{formatBytes(node.size)}</span>
    </div>
  );
}
