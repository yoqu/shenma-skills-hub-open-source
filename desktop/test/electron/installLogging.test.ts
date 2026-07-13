import { describe, expect, it } from 'vitest';
import { createDesktopLogger, createMemoryLogWriter } from '../../electron/logger';
import * as installLogging from '../../electron/installLogging';

describe('install logging', () => {
  it('writes install steps with the same install id and safe context', () => {
    const writer = createMemoryLogWriter();
    const logger = createDesktopLogger({
      writer,
      now: () => new Date(2026, 5, 4, 2, 12, 33),
    });
    const context = (installLogging as any).createInstallLogContext({
      installId: 'install_123',
      slug: 'demo',
      version: '1.0.0',
      source: 'PUBLIC',
      userSkillId: 10,
      skillId: 20,
      zipUrl: 'https://example.com/skill.zip?token=secret&expires=1',
    });

    (installLogging as any).logInstallStep(logger, context, 'install started');
    (installLogging as any).logInstallStep(logger, context, 'package extracted', { extractDir: '/tmp/extract' });
    (installLogging as any).logInstallStep(logger, context, 'install failed', { error: new Error('boom') }, 'error');

    const output = writer.lines.join('\n');
    expect(output.match(/installId=install_123/g)).toHaveLength(3);
    expect(output).toContain('slug=demo');
    expect(output).toContain('version=1.0.0');
    expect(output).toContain('source=PUBLIC');
    expect(output).toContain('userSkillId=10');
    expect(output).toContain('skillId=20');
    expect(output).toContain('zipUrl=https://example.com/skill.zip?token=%3Credacted%3E&expires=1');
    expect(output).not.toContain('secret');
  });
});
