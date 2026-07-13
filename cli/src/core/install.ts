import fs from 'node:fs';
import path from 'node:path';
import yauzl from 'yauzl';
import { fsError, CliError } from './errors';

export class InstallError extends CliError {
  constructor(message: string) { super(3, message); }
}

interface ZipEntry { fileName: string; isDirectory: boolean; readable: () => Promise<Buffer>; }

function openZip(buf: Buffer): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buf, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error('zip open failed'));
      resolve(zip);
    });
  });
}

function listEntries(buf: Buffer): Promise<ZipEntry[]> {
  return new Promise(async (resolve, reject) => {
    const entries: ZipEntry[] = [];
    let zip: yauzl.ZipFile;
    try {
      zip = await openZip(buf);
    } catch (e) { return reject(e); }
    zip.on('error', (err: Error) => {
      // yauzl emits "invalid relative path: …" for zip-slip / traversal entries
      if (err.message.startsWith('invalid relative path')) {
        return reject(new InstallError(`zip-slip detected: ${err.message}`));
      }
      reject(err);
    });
    zip.on('entry', (entry: yauzl.Entry) => {
      const isDir = /\/$/.test(entry.fileName);
      entries.push({
        fileName: entry.fileName,
        isDirectory: isDir,
        readable: () => new Promise<Buffer>((res, rej) => {
          zip.openReadStream(entry, (err, stream) => {
            if (err || !stream) return rej(err ?? new Error('open stream failed'));
            const chunks: Buffer[] = [];
            stream.on('data', (c: Buffer) => chunks.push(c));
            stream.on('end', () => res(Buffer.concat(chunks)));
            stream.on('error', rej);
          });
        }),
      });
      zip.readEntry();
    });
    zip.on('end', () => resolve(entries));
    zip.readEntry();
  });
}

/**
 * macOS Finder ("Compress") 打的 zip 会塞进 `__MACOSX/` 影子目录、`.DS_Store`
 * 以及 `._foo` AppleDouble 资源副本。这些都不是 skill 内容，解压前一律剔除，
 * 否则会被误判成"第二个顶层目录"导致安装直接报错。
 */
function isJunkEntry(name: string): boolean {
  if (name === '__MACOSX' || name.startsWith('__MACOSX/')) return true;
  const base = name.replace(/\/+$/, '').split('/').pop() ?? '';
  if (base === '.DS_Store') return true;
  if (base.startsWith('._')) return true;
  return false;
}

/**
 * 决定解压时要剥掉的顶层前缀，兼容多种打包结构：
 * - 扁平包：SKILL.md 直接在根 → 不剥前缀（返回 ''）。
 * - 包裹包：单一顶层目录（如 `weather-1.0.0/`）→ 剥掉该目录。
 * - 多个真实顶层目录 → 结构不明确，报错。
 * 入参 entries 必须已剔除 macOS 垃圾条目。
 */
function detectStripPrefix(entries: ZipEntry[]): string {
  const tops = new Set<string>();
  let hasRootSkillMd = false;
  for (const e of entries) {
    const parts = e.fileName.split('/').filter(Boolean);
    if (parts.length === 0) continue;
    tops.add(parts[0]);
    if (!e.isDirectory && parts.length === 1 && parts[0].toLowerCase() === 'skill.md') {
      hasRootSkillMd = true;
    }
  }
  // 根目录已有 SKILL.md：视为扁平包，原样解压。
  if (hasRootSkillMd) return '';
  if (tops.size === 1) return [...tops][0];
  throw new InstallError(`expected a single top-level directory in the zip, got ${tops.size}: [${[...tops].join(', ')}]`);
}

function stripTop(name: string, top: string): string {
  if (name === top || name === top + '/') return '';
  if (name.startsWith(top + '/')) return name.slice(top.length + 1);
  return name;
}

function safeJoin(root: string, rel: string): string {
  const resolved = path.resolve(root, rel);
  if (!(resolved === root || resolved.startsWith(root + path.sep))) {
    throw new InstallError(`zip-slip detected: ${rel}`);
  }
  return resolved;
}

export async function extractStrippedZip(buf: Buffer, targetDir: string): Promise<void> {
  const entries = (await listEntries(buf)).filter(e => !isJunkEntry(e.fileName));
  const top = detectStripPrefix(entries);
  const root = path.resolve(targetDir);

  // Pre-flight: ensure SKILL.md exists post-strip
  const stripped = entries
    .filter(e => !e.isDirectory)
    .map(e => stripTop(e.fileName, top))
    .filter(Boolean);
  if (!stripped.some(p => p.toLowerCase() === 'skill.md')) {
    throw new InstallError('downloaded zip does not contain SKILL.md after stripping top-level directory');
  }

  fs.mkdirSync(root, { recursive: true });

  for (const e of entries) {
    const rel = stripTop(e.fileName, top);
    if (!rel) continue;
    const dest = safeJoin(root, rel);
    if (e.isDirectory) {
      fs.mkdirSync(dest, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const data = await e.readable();
    fs.writeFileSync(dest, data);
  }
}

export function clearTargetDir(dir: string): void {
  if (fs.existsSync(dir)) {
    try { fs.rmSync(dir, { recursive: true, force: true }); }
    catch (e) { throw fsError(`failed to clear ${dir}: ${(e as Error).message}`); }
  }
}

/**
 * 在 agent 目录下建立一个指向真实内容目录的软链。已存在的同名文件/目录/软链先移除。
 * Windows 上目录软链需特权，改用 junction（无需管理员）。
 */
export function linkSkill(linkPath: string, contentPath: string): void {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  removeIfExists(linkPath);
  const type = process.platform === 'win32' ? 'junction' : 'dir';
  try {
    fs.symlinkSync(contentPath, linkPath, type);
  } catch (e) {
    throw fsError(`failed to link ${linkPath} -> ${contentPath}: ${(e as Error).message}`);
  }
}

/** 移除路径本身（软链只删链接、不动目标），不存在则忽略。 */
function removeIfExists(p: string): void {
  try { fs.lstatSync(p); } catch { return; }
  fs.rmSync(p, { recursive: true, force: true });
}
