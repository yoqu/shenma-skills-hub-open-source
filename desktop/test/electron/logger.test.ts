import { describe, expect, it } from 'vitest';
import {
  createDesktopLogger,
  createMemoryLogWriter,
  sanitizeForLog,
  serializeErrorForLog,
  summarizeBodyForLog,
} from '../../electron/logger';

describe('desktop logger', () => {
  it('formats lines with date, time, level, module, message and fields', () => {
    const writer = createMemoryLogWriter();
    const logger = createDesktopLogger({
      writer,
      now: () => new Date(2026, 5, 4, 2, 12, 33),
    });

    logger.error('skillstack_desktop::api', 'POST /api/user-skills/import failed', {
      status: 400,
      durationMs: 128,
      requestId: 'api_1',
    });

    expect(writer.lines[0]).toBe(
      '[2026-06-04][02:12:33][ERROR][skillstack_desktop::api] POST /api/user-skills/import failed status=400 durationMs=128 requestId=api_1',
    );
  });

  it('redacts credentials but keeps backend envelope code visible', () => {
    expect(sanitizeForLog({
      password: 'secret',
      token: 'abc',
      accessToken: 'bearer',
      authorization: 'Bearer token',
      cookie: 'session=secret',
      code: 40004,
      nested: { verificationCode: '123456' },
    })).toEqual({
      password: '<redacted>',
      token: '<redacted>',
      accessToken: '<redacted>',
      authorization: '<redacted>',
      cookie: '<redacted>',
      code: 40004,
      nested: { verificationCode: '<redacted>' },
    });
  });

  it('summarizes large bodies with truncation metadata', () => {
    const result = summarizeBodyForLog({ value: 'x'.repeat(20) }, { maxLength: 12 });

    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(12);
    expect(result.originalLength).toBeGreaterThan(12);
  });

  it('summarizes serialized form data without file bytes', () => {
    const result = summarizeBodyForLog({
      kind: 'formData',
      entries: [
        { name: 'slug', value: 'demo' },
        {
          name: 'package',
          fileName: 'skill.zip',
          mimeType: 'application/zip',
          data: new ArrayBuffer(8),
        },
      ],
    });

    expect(result.text).toContain('"slug":"demo"');
    expect(result.text).toContain('"fileName":"skill.zip"');
    expect(result.text).toContain('"size":8');
    expect(result.text).not.toContain('data');
  });

  it('serializes errors for logs', () => {
    expect(serializeErrorForLog(new Error('network failed'))).toMatchObject({
      name: 'Error',
      message: 'network failed',
    });
  });
});
