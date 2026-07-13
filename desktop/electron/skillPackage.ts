import fs from 'node:fs/promises';
import path from 'node:path';
import yauzl from 'yauzl';

type ZipEntry = {
  fileName: string;
  isDirectory: boolean;
  read: () => Promise<Buffer>;
};

export async function extractSkillPackage(zipPath: string, targetDir: string): Promise<void> {
  const zipBuffer = await fs.readFile(zipPath);
  const entries = await listEntries(zipBuffer);
  const packageRoot = resolvePackageRoot(entries);
  const targetRoot = path.resolve(targetDir);

  await fs.mkdir(targetRoot, { recursive: true });

  for (const entry of entries) {
    const relativePath = stripPackageRoot(entry.fileName, packageRoot);
    if (!relativePath) {
      continue;
    }

    const destinationPath = safeJoin(targetRoot, relativePath);
    if (entry.isDirectory) {
      await fs.mkdir(destinationPath, { recursive: true });
      continue;
    }

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.writeFile(destinationPath, await entry.read());
  }
}

function openZip(buffer: Buffer): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zipFile) => {
      if (error || !zipFile) {
        reject(error || new Error('INVALID_SKILL_PACKAGE'));
        return;
      }
      resolve(zipFile);
    });
  });
}

async function listEntries(buffer: Buffer): Promise<ZipEntry[]> {
  const zipFile = await openZip(buffer);

  return new Promise((resolve, reject) => {
    const entries: ZipEntry[] = [];

    zipFile.on('error', (error: Error) => {
      if (error.message.startsWith('invalid relative path')) {
        reject(new Error('ZIP_SLIP_DETECTED'));
        return;
      }
      reject(error);
    });
    zipFile.on('entry', (entry: yauzl.Entry) => {
      const isDirectory = entry.fileName.endsWith('/');
      entries.push({
        fileName: entry.fileName,
        isDirectory,
        read: () => readEntry(zipFile, entry),
      });
      zipFile.readEntry();
    });
    zipFile.on('end', () => resolve(entries));
    zipFile.readEntry();
  });
}

function readEntry(zipFile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(error || new Error('INVALID_SKILL_PACKAGE'));
        return;
      }

      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  });
}

function resolvePackageRoot(entries: ZipEntry[]): string {
  const fileEntries = entries.filter((entry) => !entry.isDirectory);
  const rootSkillMd = fileEntries.some((entry) => normalizeEntryName(entry.fileName) === 'SKILL.md');

  if (rootSkillMd) {
    return '';
  }

  const skillMdDirs = fileEntries
    .map((entry) => normalizeEntryName(entry.fileName))
    .filter((name) => name.toLowerCase().endsWith('/skill.md'))
    .map((name) => path.dirname(name));
  const uniqueSkillMdDirs = new Set(skillMdDirs);
  if (uniqueSkillMdDirs.size === 1) {
    return [...uniqueSkillMdDirs][0];
  }
  if (uniqueSkillMdDirs.size > 1) {
    throw new Error('INVALID_SKILL_PACKAGE');
  }

  const topLevelDirs = new Set<string>();
  for (const entry of entries) {
    const topLevelDir = normalizeEntryName(entry.fileName).split('/')[0];
    if (topLevelDir) {
      topLevelDirs.add(topLevelDir);
    }
  }

  if (topLevelDirs.size !== 1) {
    throw new Error('INVALID_SKILL_PACKAGE');
  }

  const packageRoot = [...topLevelDirs][0];
  const hasNestedSkillMd = fileEntries.some((entry) => stripPackageRoot(entry.fileName, packageRoot) === 'SKILL.md');
  if (!hasNestedSkillMd) {
    throw new Error('INVALID_SKILL_PACKAGE');
  }

  return packageRoot;
}

function stripPackageRoot(fileName: string, packageRoot: string): string {
  const normalized = normalizeEntryName(fileName);
  if (!packageRoot) {
    return normalized;
  }
  if (normalized === packageRoot) {
    return '';
  }
  if (normalized.startsWith(`${packageRoot}/`)) {
    return normalized.slice(packageRoot.length + 1);
  }
  return normalized;
}

function safeJoin(root: string, relativePath: string): string {
  const destinationPath = path.resolve(root, relativePath);
  if (destinationPath !== root && !destinationPath.startsWith(`${root}${path.sep}`)) {
    throw new Error('ZIP_SLIP_DETECTED');
  }
  return destinationPath;
}

function normalizeEntryName(fileName: string): string {
  return fileName.replace(/\\/g, '/').replace(/^\/+/, '');
}
