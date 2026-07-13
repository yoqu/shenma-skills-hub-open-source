import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractStrippedZip, InstallError, linkSkill } from '../../src/core/install';
import { ZipBuilder } from './zipBuilder';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'smskill-inst-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('extractStrippedZip', () => {
  it('extracts and strips top-level wrapper dir', async () => {
    const zip = new ZipBuilder()
      .add('weather-helper-1.0.0/SKILL.md', '# weather\n')
      .add('weather-helper-1.0.0/scripts/run.sh', '#!/bin/sh\n')
      .build();
    const target = path.join(tmp, 'weather-helper');
    await extractStrippedZip(zip, target);
    expect(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8')).toBe('# weather\n');
    expect(fs.readFileSync(path.join(target, 'scripts', 'run.sh'), 'utf8')).toBe('#!/bin/sh\n');
  });

  it('rejects zip-slip paths', async () => {
    // Use buildRaw() so the traversal entry name is stored verbatim in the zip
    // without being resolved by the OS at filesystem-write time.
    const zip = new ZipBuilder()
      .add('weather-helper-1.0.0/../../etc/evil', 'x')
      .add('weather-helper-1.0.0/SKILL.md', 'placeholder')
      .buildRaw();
    const target = path.join(tmp, 'weather-helper');
    await expect(extractStrippedZip(zip, target)).rejects.toBeInstanceOf(InstallError);
  });

  it('errors when no SKILL.md present after strip', async () => {
    const zip = new ZipBuilder()
      .add('weather-helper-1.0.0/notes.txt', 'no skill')
      .build();
    const target = path.join(tmp, 'weather-helper');
    await expect(extractStrippedZip(zip, target)).rejects.toThrow(/SKILL\.md/);
  });

  it('errors when entries have multiple top-level dirs', async () => {
    const zip = new ZipBuilder()
      .add('a/SKILL.md', 'x')
      .add('b/SKILL.md', 'y')
      .build();
    const target = path.join(tmp, 'mixed');
    await expect(extractStrippedZip(zip, target)).rejects.toThrow(/single top-level/);
  });

  it('ignores macOS __MACOSX and AppleDouble junk alongside the wrapper dir', async () => {
    // Reproduces the Finder "Compress" layout that previously failed with
    // "expected a single top-level directory ... got 2: [smskill-cli, __MACOSX]".
    const zip = new ZipBuilder()
      .add('smskill-cli/SKILL.md', '# cli\n')
      .add('smskill-cli/scripts/run.sh', '#!/bin/sh\n')
      .add('__MACOSX/smskill-cli/._SKILL.md', 'resource-fork')
      .add('__MACOSX/._smskill-cli', 'resource-fork')
      .add('smskill-cli/.DS_Store', 'junk')
      .buildRaw();
    const target = path.join(tmp, 'smskill-cli');
    await extractStrippedZip(zip, target);
    expect(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8')).toBe('# cli\n');
    expect(fs.existsSync(path.join(target, 'scripts', 'run.sh'))).toBe(true);
    expect(fs.existsSync(path.join(target, '.DS_Store'))).toBe(false);
    expect(fs.existsSync(path.join(target, '._SKILL.md'))).toBe(false);
  });

  it('extracts a flat zip with SKILL.md at the root (no wrapper dir)', async () => {
    const zip = new ZipBuilder()
      .add('SKILL.md', '# flat\n')
      .add('scripts/run.sh', '#!/bin/sh\n')
      .add('.DS_Store', 'junk')
      .buildRaw();
    const target = path.join(tmp, 'flat-skill');
    await extractStrippedZip(zip, target);
    expect(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8')).toBe('# flat\n');
    expect(fs.existsSync(path.join(target, 'scripts', 'run.sh'))).toBe(true);
    expect(fs.existsSync(path.join(target, '.DS_Store'))).toBe(false);
  });
});

describe('linkSkill', () => {
  it('creates a symlink pointing at the content dir', () => {
    const content = path.join(tmp, '.agents', 'skills', 'foo');
    fs.mkdirSync(content, { recursive: true });
    fs.writeFileSync(path.join(content, 'SKILL.md'), '# foo\n');

    const link = path.join(tmp, '.claude', 'skills', 'foo');
    linkSkill(link, content);

    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(path.join(link, 'SKILL.md'), 'utf8')).toBe('# foo\n');
  });

  it('replaces an existing file/symlink at the link path', () => {
    const content = path.join(tmp, 'store', 'bar');
    fs.mkdirSync(content, { recursive: true });
    fs.writeFileSync(path.join(content, 'SKILL.md'), 'new\n');

    const link = path.join(tmp, 'agentdir', 'bar');
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.writeFileSync(link, 'stale');

    linkSkill(link, content);
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(path.join(link, 'SKILL.md'), 'utf8')).toBe('new\n');
  });
});
