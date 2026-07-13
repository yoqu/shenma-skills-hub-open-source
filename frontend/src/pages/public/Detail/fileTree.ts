import type { SkillFileEntry } from '@/api/endpoints';

export interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  children: FileTreeNode[];
}

/**
 * 把扁平 paths 装配成嵌套树。目录排在文件前，同类按 name 升序。
 * 目录节点的 size 为子树文件大小之和；目录的 path 为该目录的完整前缀（含尾随 /）。
 */
export function buildFileTree(entries: SkillFileEntry[]): FileTreeNode[] {
  const root: FileTreeNode = {
    name: '',
    path: '',
    isDir: true,
    size: 0,
    children: [],
  };

  for (const entry of entries) {
    if (!entry.path) continue;
    const parts = entry.path.split('/').filter((p) => p.length > 0);
    if (parts.length === 0) continue;

    let cursor = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const partialPath = parts.slice(0, i + 1).join('/') + (isLast ? '' : '/');

      let next = cursor.children.find((c) => c.name === name && c.isDir === !isLast);
      if (!next) {
        next = {
          name,
          path: partialPath,
          isDir: !isLast,
          size: isLast ? Math.max(0, entry.size ?? 0) : 0,
          children: [],
        };
        cursor.children.push(next);
      } else if (isLast) {
        // 同名文件被重复列出（理论上不应该出现），覆盖 size 用最大值
        next.size = Math.max(next.size, Math.max(0, entry.size ?? 0));
      }
      cursor = next;
    }
  }

  rollupSizes(root);
  sortRecursive(root);
  return root.children;
}

export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function rollupSizes(node: FileTreeNode): number {
  if (!node.isDir) return node.size;
  let total = 0;
  for (const child of node.children) {
    total += rollupSizes(child);
  }
  node.size = total;
  return total;
}

function sortRecursive(node: FileTreeNode): void {
  node.children.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of node.children) {
    sortRecursive(child);
  }
}
