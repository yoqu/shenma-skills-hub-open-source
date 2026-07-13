import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ZipBuilder } from './core/zipBuilder';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'src', 'cli.ts');
const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');

interface SeenRequest {
  method: string;
  url: string;
  body: unknown;
  auth?: string;
}

interface MockServer {
  baseUrl: string;
  seen: SeenRequest[];
  close: () => Promise<void>;
}

let tmp: string;
let server: MockServer;

interface CmdResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

function run(args: string[], cwd = tmp): Promise<CmdResult> {
  return runProc(process.execPath, [tsx, cli, ...args], {
    cwd,
    env: {
      ...process.env,
      SMSKILL_HOME: path.join(tmp, 'home'),
      SMSKILL_API_BASE_URL: server.baseUrl,
      SMSKILL_TOKEN: 'jwt_test',
      SMSKILL_TEAM_ID: '1',
    },
  });
}

function runTsx(args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): Promise<CmdResult> {
  return runProc(process.execPath, [tsx, cli, ...args], {
    cwd: opts.cwd ?? tmp,
    env: opts.env ?? process.env,
  });
}

function runProc(command: string, args: string[], opts: { cwd: string; env: NodeJS.ProcessEnv }): Promise<CmdResult> {
  return new Promise(resolve => {
    const child = spawn(command, args, { cwd: opts.cwd, env: opts.env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), 10_000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => {
      clearTimeout(timer);
      resolve({ status: null, stdout, stderr, error });
    });
    child.on('close', status => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}

function outputOf(r: CmdResult): string {
  return `status=${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}\nerror=${r.error?.message ?? ''}`;
}

function json(data: unknown) {
  return JSON.stringify({ code: 0, message: 'ok', data });
}

async function startServer(): Promise<MockServer> {
  const seen: SeenRequest[] = [];
  const skillZip = new ZipBuilder()
    .add('mono-format/SKILL.md', '---\nname: mono-format\ndescription: test\n---\n# Mono\n')
    .build();
  const srv = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const bodyText = Buffer.concat(chunks).toString('utf8');
      let body: unknown = bodyText;
      try { body = bodyText ? JSON.parse(bodyText) : undefined; } catch { /* keep raw */ }
      seen.push({ method: req.method ?? 'GET', url: req.url ?? '/', body, auth: req.headers.authorization });

      res.setHeader('Content-Type', 'application/json');
      if (req.url?.startsWith('/api/skills/mono-format/download')) {
        res.setHeader('Content-Type', 'application/zip');
        res.end(skillZip);
        return;
      }
      if (req.url?.startsWith('/api/skills?')) {
        res.end(json({ items: [{ id: 1, slug: 'mono-format', name: 'Mono Format', version: '2.4.1', installs: 10, stars: 3, safety: 'pass', team: 'ludou-fe' }], total: 1, page: 1, size: 20 }));
        return;
      }
      if (req.url?.startsWith('/api/prompts?')) {
        res.end(json({
          items: [{
            id: 2,
            slug: 'review-context',
            teamSlug: 'ludou-fe',
            name: 'Review Context',
            version: '0.1.0',
            exports: 4,
            visibility: 'PUBLIC',
          }],
          total: 1,
          page: 1,
          size: 20,
        }));
        return;
      }
      if (req.url === '/api/teams/mine') {
        res.end(json([
          { id: 1, slug: 'ludou-fe', name: 'Ludou FE', role: 'OWNER', members: 3 },
          { id: 5, slug: 'ludou-develop-team', name: 'Ludou Develop', role: 'OWNER', members: 11 },
        ]));
        return;
      }
      if (req.url === '/api/teams/1/detail') {
        res.end(json({ id: 1, slug: 'ludou-fe', name: 'Ludou FE' }));
        return;
      }
      if (req.url === '/api/teams/ludou-fe/prompts/review-context') {
        res.end(json({
          id: 2,
          slug: 'review-context',
          teamSlug: 'ludou-fe',
          name: 'Review Context',
          version: '0.1.0',
          visibility: 'PUBLIC',
          contentMd: '# Review Context',
        }));
        return;
      }
      if (req.url?.startsWith('/api/teams/ludou-fe/prompts/review-context/download')) {
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', 'attachment; filename="review-context.md"');
        res.end('# Review Context\n');
        return;
      }
      if (req.url === '/api/skills/mono-format') {
        res.end(json({ id: 1, slug: 'mono-format', name: 'Mono Format', shortDesc: 'Format mono repo', version: '2.4.1', visibility: 'PUBLIC', safety: 'pass', team: { slug: 'ludou-fe' } }));
        return;
      }
      if (req.url === '/api/skills/mono-format/versions') {
        res.end(json([{ version: '2.4.1', latest: true, date: '2026-05-22', installs: 10, note: 'seed' }]));
        return;
      }
      if (req.url === '/api/skills/1/install' || req.url === '/api/suites/9/install') {
        res.end(json({ installs: 11 }));
        return;
      }
      if (req.url === '/api/skills/versions/upload-text') {
        res.end(json({ zipUrl: 'skill-versions/1/smskill-cli.zip', url: '/uploads/smskill-cli.zip' }));
        return;
      }
      if (req.url === '/api/skills/versions/parse') {
        res.end(json({
          zipUrl: 'skill-versions/1/smskill-cli.zip',
          size: 123,
          sha256: 'abc',
          entryCount: 1,
          fileCount: 1,
          skillMdPath: 'SKILL.md',
          hasSkillMd: true,
          hasFrontmatter: true,
          parsed: { name: 'smskill-cli', version: '0.1.0', description: 'SkillStack CLI docs', category: 'dev', tags: ['cli'], langs: ['typescript'] },
          checks: [{ status: 'pass', name: 'SKILL.md', detail: 'ok' }],
          ok: true,
        }));
        return;
      }
      if (req.url === '/api/skills') {
        res.end(json({ id: null, slug: 'smskill-cli', status: 'PENDING_REVIEW', pendingReview: true, reviewId: 77 }));
        return;
      }
      if (req.url?.startsWith('/api/teams/1/suites?')) {
        res.end(json({ items: [{ id: 9, slug: 'onboard', name: 'Onboard', skills: 1, installs: 2, visibility: 'TEAM_PRIVATE', updatedAt: '2026-05-22T00:00:00' }], total: 1, page: 1, size: 20 }));
        return;
      }
      if (req.url === '/api/teams/1/suites/by-slug/onboard') {
        res.end(json({
          id: 9,
          slug: 'onboard',
          name: 'Onboard',
          teamId: 1,
          teamSlug: 'ludou-fe',
          visibility: 'TEAM_PRIVATE',
          installs: 2,
          skillsCount: 1,
          skills: [{ id: 1, slug: 'mono-format', name: 'Mono Format', version: '2.4.1', position: 1, installs: 10 }],
          items: [
            { type: 'SKILL', id: 1, slug: 'mono-format', name: 'Mono Format', version: '2.4.1', position: 1, installs: 10 },
            { type: 'PROMPT', id: 2, slug: 'review-context', name: 'Review Context', version: '0.1.0', position: 2, exports: 4 },
          ],
        }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ code: 40400, message: `not found ${req.url}`, data: null }));
    });
  });
  await new Promise<void>(resolve => srv.listen(0, '127.0.0.1', resolve));
  const addr = srv.address();
  if (!addr || typeof addr === 'string') throw new Error('server listen failed');
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    seen,
    close: () => new Promise(resolve => srv.close(() => resolve())),
  };
}

beforeEach(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'smskill-cmd-'));
  server = await startServer();
});

afterEach(async () => {
  await server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('smskill commands', () => {
  it('config command sets, gets, checks, prints path, and unsets values', async () => {
    const env = { ...process.env, SMSKILL_HOME: path.join(tmp, 'home') };
    const set = await runTsx(['config', 'set', 'apiBaseUrl', server.baseUrl], { cwd: tmp, env });
    expect(set.status).toBe(0);
    const get = await runTsx(['config', 'get', 'apiBaseUrl'], { cwd: tmp, env });
    expect(get.stdout).toContain(server.baseUrl);
    await runTsx(['config', 'set', 'token', 'jwt_test'], { cwd: tmp, env });
    const check = await runTsx(['config', 'check'], { cwd: tmp, env: { ...env, SMSKILL_TEAM_ID: '1' } });
    expect(check.status, outputOf(check)).toBe(0);
    expect(check.stdout).toContain('apiBaseUrl OK');
    expect(check.stdout).toContain('token OK');
    const pathOut = await runTsx(['config', 'path'], { cwd: tmp, env });
    expect(pathOut.stdout).toContain(path.join(tmp, 'home', 'config.json'));
    const unset = await runTsx(['config', 'unset', 'token'], { cwd: tmp, env });
    expect(unset.status).toBe(0);
  });

  it('team list/use/current resolve via /api/teams/mine and upload accepts a team slug', async () => {
    const env = {
      ...process.env,
      SMSKILL_HOME: path.join(tmp, 'home'),
      SMSKILL_API_BASE_URL: server.baseUrl,
      SMSKILL_TOKEN: 'jwt_test',
    };
    const list = await runTsx(['team', 'list'], { cwd: tmp, env });
    expect(list.status, outputOf(list)).toBe(0);
    expect(list.stdout).toContain('ludou-develop-team');

    const use = await runTsx(['team', 'use', 'ludou-develop-team'], { cwd: tmp, env });
    expect(use.status, outputOf(use)).toBe(0);
    expect(use.stdout).toContain('default team');

    const current = await runTsx(['team', 'current'], { cwd: tmp, env });
    expect(current.status, outputOf(current)).toBe(0);
    expect(current.stdout).toContain('id 5');

    const skillDir = path.join(tmp, 'sk');
    fs.mkdirSync(skillDir);
    fs.copyFileSync(path.join(root, '..', 'docs', 'skills', 'smskill-cli', 'SKILL.md'), path.join(skillDir, 'SKILL.md'));
    const up = await runTsx(['upload', skillDir, '--team', 'ludou-develop-team', '--slug', 'x-by-slug'], { cwd: tmp, env });
    expect(up.status, outputOf(up)).toBe(0);
    expect(up.stdout).toContain('team: 5');
    const created = server.seen.find(r => r.url === '/api/skills');
    expect((created?.body as { teamId?: number })?.teamId).toBe(5);
  });

  it('search, info, upload, install, list, remove, and suite commands execute against the API', async () => {
    const skillDir = path.join(tmp, 'smskill-cli');
    fs.mkdirSync(skillDir);
    fs.copyFileSync(path.join(root, '..', 'docs', 'skills', 'smskill-cli', 'SKILL.md'), path.join(skillDir, 'SKILL.md'));

    const search = await run(['search', 'mono']);
    expect(search.stdout, outputOf(search)).toContain('mono-format');
    const searchJson = await run(['search', 'mono', '--json']);
    expect(searchJson.stdout, outputOf(searchJson)).toContain('"slug": "mono-format"');
    const info = await run(['info', 'mono-format']);
    expect(info.stdout, outputOf(info)).toContain('Mono Format');
    const promptSearch = await run(['prompt', 'search', 'review']);
    expect(promptSearch.status, outputOf(promptSearch)).toBe(0);
    expect(promptSearch.stdout).toContain('review-context');
    expect(server.seen.some(r => r.url?.includes('/api/prompts?') && r.url.includes('q=review'))).toBe(true);
    const promptGet = await run(['prompt', 'get', 'review-context', '--prompts-dir', path.join(tmp, 'prompts')]);
    expect(promptGet.status, outputOf(promptGet)).toBe(0);
    expect(fs.existsSync(path.join(tmp, 'prompts', 'ludou-fe', 'review-context.md'))).toBe(true);
    expect(server.seen.some(r => r.url === '/api/teams/1/detail')).toBe(true);

    const upload = await run(['upload', skillDir, '--team', '1', '--slug', 'smskill-cli-test']);
    expect(upload.status).toBe(0);
    expect(upload.stdout).toContain('Uploaded smskill-cli');
    expect(server.seen.some(r => r.url === '/api/skills/versions/upload-text')).toBe(true);
    expect(server.seen.some(r => r.url === '/api/skills/versions/parse')).toBe(true);
    expect(server.seen.some(r => r.url === '/api/skills')).toBe(true);

    const target = path.join(tmp, 'installed');
    const install = await run(['install', 'mono-format', '--dir', target]);
    expect(install.status).toBe(0);
    expect(fs.existsSync(path.join(target, 'mono-format', 'SKILL.md'))).toBe(true);

    expect((await run(['list'])).stdout).toContain('mono-format');
    expect((await run(['suite', 'list'])).stdout).toContain('onboard');
    const suiteInfo = await run(['suite', 'info', '1/onboard']);
    expect(suiteInfo.stdout).toContain('Mono Format');
    expect(suiteInfo.stdout).toContain('Review Context');
    const suiteInstall = await run(['suite', 'install', '1/onboard', '--dir', target, '--force']);
    expect(suiteInstall.stdout).toContain('Summary: 2 installed/exported, 0 failed');
    expect(fs.existsSync(path.join(tmp, 'home', 'prompts', 'ludou-fe', 'review-context.md'))).toBe(true);
    expect((await run(['list', '--suite', '1/onboard'])).stdout).toContain('mono-format');
    expect((await run(['remove', 'mono-format', '--agent', 'claude', '--scope', 'user'])).stdout).toContain('Removed mono-format');
  });

  it('user-scope install fans out to multiple agents via ~/.agents/skills symlinks', async () => {
    const fakeHome = path.join(tmp, 'fakehome');
    const env = {
      ...process.env,
      HOME: fakeHome,
      SMSKILL_HOME: path.join(tmp, 'home2'),
      SMSKILL_API_BASE_URL: server.baseUrl,
      SMSKILL_TOKEN: 'jwt_test',
      SMSKILL_TEAM_ID: '1',
    };
    const runHome = (args: string[]) => runProc(process.execPath, [tsx, cli, ...args], { cwd: tmp, env });

    const store = path.join(fakeHome, '.agents', 'skills', 'mono-format');
    const claudeLink = path.join(fakeHome, '.claude', 'skills', 'mono-format');
    const codexLink = path.join(fakeHome, '.codex', 'skills', 'mono-format');

    const install = await runHome(['install', 'mono-format', '--agent', 'claude,codex', '--scope', 'user']);
    expect(install.status, outputOf(install)).toBe(0);
    // real content in the shared store
    expect(fs.readFileSync(path.join(store, 'SKILL.md'), 'utf8')).toContain('Mono');
    // each agent dir is a symlink into the store
    expect(fs.lstatSync(claudeLink).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(codexLink).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(path.join(claudeLink, 'SKILL.md'), 'utf8')).toContain('Mono');

    // remove one agent: its symlink goes, store + other agent remain
    const rmClaude = await runHome(['remove', 'mono-format', '--agent', 'claude', '--scope', 'user']);
    expect(rmClaude.status, outputOf(rmClaude)).toBe(0);
    expect(fs.existsSync(claudeLink)).toBe(false);
    expect(fs.existsSync(store)).toBe(true);
    expect(fs.lstatSync(codexLink).isSymbolicLink()).toBe(true);

    // remove last agent: store is reclaimed
    const rmCodex = await runHome(['remove', 'mono-format', '--agent', 'codex', '--scope', 'user']);
    expect(rmCodex.status, outputOf(rmCodex)).toBe(0);
    expect(fs.existsSync(codexLink)).toBe(false);
    expect(fs.existsSync(store)).toBe(false);
  });

  it('global built command can print version after npm link', () => {
    execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'pipe' });
    execFileSync('npm', ['link'], { cwd: root, stdio: 'pipe' });
    const out = execFileSync('smskill', ['--version'], { cwd: tmp, encoding: 'utf8' });
    expect(out.trim()).toBe('0.2.0');
  });
});
