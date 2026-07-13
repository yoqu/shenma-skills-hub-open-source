import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractSkillPackage } from '../../electron/skillPackage';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skillstack-desktop-zip-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('extractSkillPackage', () => {
  it('extracts a package with SKILL.md at zip root', async () => {
    const zipPath = buildZip([
      ['SKILL.md', '# Demo\n'],
      ['scripts/run.sh', '#!/bin/sh\n'],
    ]);
    const targetDir = path.join(tmp, 'target');

    await extractSkillPackage(zipPath, targetDir);

    await expect(fsp.readFile(path.join(targetDir, 'SKILL.md'), 'utf8')).resolves.toBe('# Demo\n');
    await expect(fsp.readFile(path.join(targetDir, 'scripts', 'run.sh'), 'utf8')).resolves.toBe('#!/bin/sh\n');
  });

  it('strips a single top-level package directory', async () => {
    const zipPath = buildZip([
      ['demo-skill-1.0.0/SKILL.md', '# Demo\n'],
      ['demo-skill-1.0.0/docs/readme.md', 'readme\n'],
    ]);
    const targetDir = path.join(tmp, 'target');

    await extractSkillPackage(zipPath, targetDir);

    await expect(fsp.readFile(path.join(targetDir, 'SKILL.md'), 'utf8')).resolves.toBe('# Demo\n');
    await expect(fsp.readFile(path.join(targetDir, 'docs', 'readme.md'), 'utf8')).resolves.toBe('readme\n');
  });

  it('extracts a package from the directory that contains the only SKILL.md', async () => {
    const zipPath = buildZip([
      ['repository/skills/code-doc-review/SKILL.md', '# Demo\n'],
      ['repository/skills/code-doc-review/scripts/run.sh', '#!/bin/sh\n'],
      ['repository/readme.md', 'repository readme\n'],
    ]);
    const targetDir = path.join(tmp, 'target');

    await extractSkillPackage(zipPath, targetDir);

    await expect(fsp.readFile(path.join(targetDir, 'SKILL.md'), 'utf8')).resolves.toBe('# Demo\n');
    await expect(fsp.readFile(path.join(targetDir, 'scripts', 'run.sh'), 'utf8')).resolves.toBe('#!/bin/sh\n');
    await expect(fsp.readFile(path.join(targetDir, 'readme.md'), 'utf8')).rejects.toThrow();
  });

  it('rejects zip-slip entries', async () => {
    const zipPath = buildRawZip([
      ['demo-skill-1.0.0/SKILL.md', '# Demo\n'],
      ['demo-skill-1.0.0/../../evil.txt', 'evil\n'],
    ]);

    await expect(extractSkillPackage(zipPath, path.join(tmp, 'target'))).rejects.toThrow();
  });

  it('rejects packages without SKILL.md', async () => {
    const zipPath = buildZip([['demo-skill-1.0.0/readme.md', 'readme\n']]);

    await expect(extractSkillPackage(zipPath, path.join(tmp, 'target'))).rejects.toThrow('INVALID_SKILL_PACKAGE');
  });
});

function buildZip(entries: Array<[string, string]>): string {
  const sourceDir = path.join(tmp, `zip-src-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(sourceDir, { recursive: true });
  for (const [name, content] of entries) {
    const filePath = path.join(sourceDir, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }

  const zipPath = path.join(tmp, `package-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`);
  execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: sourceDir });
  return zipPath;
}

function buildRawZip(entries: Array<[string, string]>): string {
  const zipPath = path.join(tmp, `raw-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`);
  const script = `
import json
import sys
import zipfile
entries = json.loads(sys.argv[1])
with zipfile.ZipFile(sys.argv[2], 'w') as zf:
    for name, content in entries:
        zf.writestr(name, content)
`;
  execFileSync('python3', ['-c', script, JSON.stringify(entries), zipPath]);
  return zipPath;
}
