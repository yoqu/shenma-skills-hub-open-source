# smskill CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Node + TypeScript CLI (`smskill`) that lets terminal users browse SkillStack, install skills + suites into Claude Code / Codex / OpenClaw / generic directories, and manage them via a central lockfile.

**Architecture:** Backend already has Personal Access Token auth wired into `JwtAuthFilter`; we extend its allowlist for two missing endpoints (skill `/versions` + suite paths). CLI is a standalone subproject at `cli/`, talking directly to backend over HTTP using PAT in `Authorization: Bearer lst_...`. Each downloaded skill is a zip whose top-level wrapper is stripped before extracting into the agent-specific directory (Claude: `~/.claude/skills/<slug>/`, etc.).

**Tech Stack:**
- Backend: Spring Boot 3.2 / Java 17 / MockMvc tests.
- CLI: Node 20+, TypeScript 5.x, commander, axios, zod, chalk, ora, cli-table3, yauzl, vitest.

**Spec:** `docs/superpowers/specs/2026-05-22-smskill-cli-design.md`.

---

## File Structure

**Backend (modified):**
- `backend/src/main/java/com/skillstack/common/security/JwtAuthFilter.java` — rewrite `isPatAllowedPath`
- `backend/src/test/java/com/skillstack/common/security/JwtAuthFilterPatTest.java` — add 5 tests

**CLI (created):**
```
cli/
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md
├── src/
│   ├── cli.ts                # commander entry, exit-code mapping
│   ├── commands/
│   │   ├── config.ts         # set/get/unset/path/check subcommands
│   │   ├── search.ts
│   │   ├── info.ts
│   │   ├── install.ts
│   │   ├── list.ts
│   │   ├── remove.ts
│   │   └── suite.ts          # list/info/install subcommands
│   ├── core/
│   │   ├── api.ts            # axios client, envelope unwrap
│   │   ├── config.ts         # ~/.smskill/config.json + env merge
│   │   ├── target.ts         # agent × scope → install_path
│   │   ├── lockfile.ts       # ~/.smskill/installed.json
│   │   ├── install.ts        # download + strip + safe extract
│   │   ├── skillRef.ts       # parse "slug[@version]"
│   │   ├── suiteRef.ts       # parse "<teamId>/<slug>" | "<slug>"
│   │   └── errors.ts         # error class + exit-code mapping
│   ├── types/api.ts          # ApiResponse, PageResult, DTO mirrors
│   └── render/
│       ├── table.ts          # cli-table3 wrapper
│       └── log.ts            # chalk + ora wrapper
└── test/core/                # vitest unit tests, one per core module
```

**Docs (modified):**
- `AGENT.md` — add `cli/` to directory list, add Node+TS to tech stack
- `cli/README.md` — full command manual

---

## Phase A — Backend PAT allowlist patch

### Task 1: Allow skill `/versions` for PAT

**Files:**
- Modify: `backend/src/main/java/com/skillstack/common/security/JwtAuthFilter.java:90-96`
- Modify: `backend/src/test/java/com/skillstack/common/security/JwtAuthFilterPatTest.java`

- [ ] **Step 1: Add the failing test**

Append to `JwtAuthFilterPatTest.java` (inside the class, after the existing `invalid_pat_returns_401` test):

```java
@Test
void pat_allowed_on_skill_versions_list() throws Exception {
    // /api/skills/<slug>/versions (no trailing segment) must pass through the filter.
    // Skill doesn't exist; controller will return 4xx, but the filter must not 403.
    mvc.perform(get("/api/skills/nonexistent/versions").header("Authorization", "Bearer " + secret))
       .andDo(res -> {
           int status = res.getResponse().getStatus();
           org.junit.jupiter.api.Assertions.assertNotEquals(401, status, "filter must not 401");
           org.junit.jupiter.api.Assertions.assertNotEquals(403, status, "filter must not 403");
       });
}
```

- [ ] **Step 2: Run the test, verify it fails**

```
cd backend
mvn -Dtest=JwtAuthFilterPatTest#pat_allowed_on_skill_versions_list test
```

Expected: test fails because the filter currently returns 403 (path not in allowlist).

- [ ] **Step 3: Update `isPatAllowedPath`**

Replace the method in `JwtAuthFilter.java` (around line 90):

```java
private static boolean isPatAllowedPath(String uri) {
    if (uri == null) return false;
    if (uri.startsWith("/api/skills/")) {
        return uri.endsWith("/install")
                || uri.endsWith("/versions")
                || uri.contains("/versions/")
                || uri.endsWith("/download")
                || uri.matches("/api/skills/[^/]+/?");
    }
    return false;
}
```

- [ ] **Step 4: Run the test, verify it passes**

```
cd backend
mvn -Dtest=JwtAuthFilterPatTest#pat_allowed_on_skill_versions_list test
```

Expected: PASS. Also run full class to confirm no regression:

```
mvn -Dtest=JwtAuthFilterPatTest test
```

Expected: all tests in the class PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/skillstack/common/security/JwtAuthFilter.java \
        backend/src/test/java/com/skillstack/common/security/JwtAuthFilterPatTest.java
git commit -m "feat(pat): allow /api/skills/<slug>/versions list under PAT"
```

---

### Task 2: Allow suite paths for PAT

**Files:**
- Modify: `backend/src/main/java/com/skillstack/common/security/JwtAuthFilter.java` (the `isPatAllowedPath` from Task 1)
- Modify: `backend/src/test/java/com/skillstack/common/security/JwtAuthFilterPatTest.java`

- [ ] **Step 1: Add four failing tests**

Append to `JwtAuthFilterPatTest.java`:

```java
@Test
void pat_allowed_on_team_suite_list() throws Exception {
    mvc.perform(get("/api/teams/" + teamId + "/suites").header("Authorization", "Bearer " + secret))
       .andExpect(status().isOk());
}

@Test
void pat_allowed_on_suite_by_slug() throws Exception {
    mvc.perform(get("/api/teams/" + teamId + "/suites/by-slug/no-such-suite").header("Authorization", "Bearer " + secret))
       .andDo(res -> {
           int status = res.getResponse().getStatus();
           org.junit.jupiter.api.Assertions.assertNotEquals(401, status);
           org.junit.jupiter.api.Assertions.assertNotEquals(403, status);
       });
}

@Test
void pat_allowed_on_suite_install_counter() throws Exception {
    mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .post("/api/suites/999999/install")
                .header("Authorization", "Bearer " + secret))
       .andDo(res -> {
           int status = res.getResponse().getStatus();
           org.junit.jupiter.api.Assertions.assertNotEquals(401, status);
           org.junit.jupiter.api.Assertions.assertNotEquals(403, status);
       });
}

@Test
void pat_rejected_on_auth_me() throws Exception {
    // Regression: PAT must not gain access to /api/auth/me even though it's an authenticated endpoint.
    mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + secret))
       .andExpect(status().isForbidden());
}
```

- [ ] **Step 2: Run the four tests, verify they fail**

```
cd backend
mvn -Dtest='JwtAuthFilterPatTest#pat_allowed_on_team_suite_list+pat_allowed_on_suite_by_slug+pat_allowed_on_suite_install_counter' test
```

Expected: all three "allowed" tests fail with 403 (filter rejects). The `pat_rejected_on_auth_me` already passes because the filter currently 403s everything non-skill — but keep it as regression guard.

- [ ] **Step 3: Extend `isPatAllowedPath`**

Replace the method in `JwtAuthFilter.java`:

```java
private static boolean isPatAllowedPath(String uri) {
    if (uri == null) return false;
    if (uri.startsWith("/api/skills/")) {
        return uri.endsWith("/install")
                || uri.endsWith("/versions")
                || uri.contains("/versions/")
                || uri.endsWith("/download")
                || uri.matches("/api/skills/[^/]+/?");
    }
    if (uri.matches("/api/teams/\\d+/suites/?")) return true;
    if (uri.matches("/api/teams/\\d+/suites/by-slug/[^/]+/?")) return true;
    if (uri.matches("/api/suites/\\d+/install/?")) return true;
    return false;
}
```

- [ ] **Step 4: Run all PAT tests, verify they pass**

```
cd backend
mvn -Dtest=JwtAuthFilterPatTest test
```

Expected: all 8 tests in the class PASS (3 existing + 5 new).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/skillstack/common/security/JwtAuthFilter.java \
        backend/src/test/java/com/skillstack/common/security/JwtAuthFilterPatTest.java
git commit -m "feat(pat): allow suite list/by-slug/install paths under PAT"
```

---

## Phase B — CLI scaffold

### Task 3: Initialize `cli/` subproject

**Files:**
- Create: `cli/package.json`
- Create: `cli/tsconfig.json`
- Create: `cli/.gitignore`
- Create: `cli/README.md`
- Create: `cli/src/cli.ts`
- Create: `cli/vitest.config.ts`
- Create: `cli/test/smoke.test.ts`

- [ ] **Step 1: Create `cli/package.json`**

```json
{
  "name": "smskill",
  "version": "0.1.0",
  "description": "SkillStack terminal client",
  "type": "module",
  "license": "UNLICENSED",
  "engines": {
    "node": ">=20"
  },
  "files": [
    "dist/",
    "README.md"
  ],
  "bin": {
    "smskill": "dist/cli.js"
  },
  "scripts": {
    "build": "tsup src/cli.ts --format esm --target node20 --out-dir dist --clean",
    "postbuild": "chmod +x dist/cli.js",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "axios": "^1.7.0",
    "chalk": "^5.3.0",
    "cli-table3": "^0.6.5",
    "commander": "^12.1.0",
    "ora": "^8.1.0",
    "yauzl": "^3.1.3",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/yauzl": "^2.10.3",
    "tsup": "^8.3.0",
    "tsx": "^4.19.0",
    "typescript": "^5.4.5",
    "vitest": "^2.0.0"
  }
}
```

> Build uses **tsup** (esbuild under the hood) rather than raw `tsc`, because `tsc` with `"type": "module"` would emit ESM imports without `.js` extensions and Node ESM would refuse to resolve them. tsup handles bundling + shebang preservation in one shot. `tsc --noEmit` remains as a separate type-check step.

- [ ] **Step 2: Create `cli/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true,
    "isolatedModules": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "test"]
}
```

- [ ] **Step 3: Create `cli/.gitignore`**

```
node_modules/
dist/
*.log
.DS_Store
```

- [ ] **Step 4: Create `cli/README.md` stub**

```markdown
# smskill

SkillStack terminal client.

See `docs/superpowers/specs/2026-05-22-smskill-cli-design.md` for the full design.

## Development

\`\`\`bash
cd cli
npm install
npm run dev -- --help
npm test
\`\`\`
```

- [ ] **Step 5: Create minimal `cli/src/cli.ts`**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();
program
  .name('smskill')
  .description('SkillStack terminal client')
  .version('0.1.0');

program.parse();
```

- [ ] **Step 6: Create `cli/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 7: Create `cli/test/smoke.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('toolchain is up', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Install dependencies and verify**

```bash
cd cli
npm install
npm run typecheck
npm test
npm run dev -- --version
npm run build
node dist/cli.js --version
```

Expected:
- `typecheck` exits 0
- `vitest` reports 1 passing test
- `npm run dev -- --version` prints `0.1.0`
- `npm run build` produces `dist/cli.js`
- `node dist/cli.js --version` prints `0.1.0` (verifies ESM build works end-to-end)

- [ ] **Step 9: Commit**

```bash
git add cli/.gitignore cli/package.json cli/tsconfig.json cli/vitest.config.ts \
        cli/README.md cli/src/cli.ts cli/test/smoke.test.ts cli/package-lock.json
git commit -m "feat(cli): scaffold smskill subproject"
```

---

## Phase C — Core modules (TDD per module)

### Task 4: `skillRef` parser

**Files:**
- Create: `cli/src/core/skillRef.ts`
- Create: `cli/test/core/skillRef.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// cli/test/core/skillRef.test.ts
import { describe, it, expect } from 'vitest';
import { parseSkillRef } from '../../src/core/skillRef';

describe('parseSkillRef', () => {
  it('parses bare slug', () => {
    expect(parseSkillRef('weather-helper')).toEqual({ slug: 'weather-helper', version: undefined });
  });
  it('parses slug with version', () => {
    expect(parseSkillRef('weather-helper@1.2.0')).toEqual({ slug: 'weather-helper', version: '1.2.0' });
  });
  it('rejects empty string', () => {
    expect(() => parseSkillRef('')).toThrow(/empty/i);
  });
  it('rejects @ without version', () => {
    expect(() => parseSkillRef('weather-helper@')).toThrow(/version/i);
  });
  it('rejects slug with slash', () => {
    expect(() => parseSkillRef('team/weather-helper')).toThrow(/slash/i);
  });
});
```

- [ ] **Step 2: Run, verify fails**

```bash
cd cli && npm test -- skillRef
```

Expected: module not found.

- [ ] **Step 3: Implement**

```typescript
// cli/src/core/skillRef.ts
export interface SkillRef {
  slug: string;
  version?: string;
}

export function parseSkillRef(input: string): SkillRef {
  const s = (input ?? '').trim();
  if (!s) throw new Error('skill ref cannot be empty');
  if (s.includes('/')) throw new Error('skill ref must not contain slash (no team prefix); use --team or set defaultTeamId for suites');
  const at = s.indexOf('@');
  if (at < 0) return { slug: s };
  const slug = s.slice(0, at);
  const version = s.slice(at + 1);
  if (!slug) throw new Error('skill ref missing slug');
  if (!version) throw new Error('skill ref version cannot be empty after @');
  return { slug, version };
}
```

- [ ] **Step 4: Run, verify passes**

```bash
cd cli && npm test -- skillRef
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/core/skillRef.ts cli/test/core/skillRef.test.ts
git commit -m "feat(cli): skillRef parser"
```

---

### Task 5: `suiteRef` parser

**Files:**
- Create: `cli/src/core/suiteRef.ts`
- Create: `cli/test/core/suiteRef.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// cli/test/core/suiteRef.test.ts
import { describe, it, expect } from 'vitest';
import { parseSuiteRef } from '../../src/core/suiteRef';

describe('parseSuiteRef', () => {
  it('parses teamId/slug', () => {
    expect(parseSuiteRef('1/onboarding-pack', undefined)).toEqual({ teamId: 1, slug: 'onboarding-pack' });
  });
  it('falls back to default teamId for bare slug', () => {
    expect(parseSuiteRef('onboarding-pack', 7)).toEqual({ teamId: 7, slug: 'onboarding-pack' });
  });
  it('rejects bare slug without default team', () => {
    expect(() => parseSuiteRef('onboarding-pack', undefined)).toThrow(/team/i);
  });
  it('rejects non-numeric teamId', () => {
    expect(() => parseSuiteRef('abc/onboarding-pack', undefined)).toThrow(/team/i);
  });
  it('rejects empty slug', () => {
    expect(() => parseSuiteRef('1/', undefined)).toThrow(/slug/i);
  });
  it('rejects too many segments', () => {
    expect(() => parseSuiteRef('1/2/3', undefined)).toThrow(/format/i);
  });
});
```

- [ ] **Step 2: Run, verify fails**

```bash
cd cli && npm test -- suiteRef
```

- [ ] **Step 3: Implement**

```typescript
// cli/src/core/suiteRef.ts
export interface SuiteRef {
  teamId: number;
  slug: string;
}

export function parseSuiteRef(input: string, defaultTeamId: number | undefined): SuiteRef {
  const s = (input ?? '').trim();
  if (!s) throw new Error('suite ref cannot be empty');
  const parts = s.split('/');
  if (parts.length === 1) {
    if (defaultTeamId == null) {
      throw new Error('suite ref missing team; pass <teamId>/<slug> or set defaultTeamId / SMSKILL_TEAM_ID');
    }
    if (!parts[0]) throw new Error('suite slug cannot be empty');
    return { teamId: defaultTeamId, slug: parts[0] };
  }
  if (parts.length !== 2) {
    throw new Error('suite ref format must be <teamId>/<slug>');
  }
  const teamId = Number(parts[0]);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    throw new Error('suite ref teamId must be a positive integer');
  }
  if (!parts[1]) throw new Error('suite slug cannot be empty');
  return { teamId, slug: parts[1] };
}
```

- [ ] **Step 4: Run, verify passes**

```bash
cd cli && npm test -- suiteRef
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/core/suiteRef.ts cli/test/core/suiteRef.test.ts
git commit -m "feat(cli): suiteRef parser"
```

---

### Task 6: `target` (agent × scope → install path)

**Files:**
- Create: `cli/src/core/target.ts`
- Create: `cli/test/core/target.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// cli/test/core/target.test.ts
import { describe, it, expect } from 'vitest';
import { resolveTarget } from '../../src/core/target';
import os from 'node:os';
import path from 'node:path';

const home = os.homedir();

describe('resolveTarget', () => {
  it('claude user', () => {
    expect(resolveTarget({ agent: 'claude', scope: 'user', cwd: '/anything' }))
      .toBe(path.join(home, '.claude', 'skills'));
  });
  it('claude project', () => {
    expect(resolveTarget({ agent: 'claude', scope: 'project', cwd: '/proj' }))
      .toBe(path.join('/proj', '.claude', 'skills'));
  });
  it('codex user', () => {
    expect(resolveTarget({ agent: 'codex', scope: 'user', cwd: '/x' }))
      .toBe(path.join(home, '.codex', 'skills'));
  });
  it('codex project', () => {
    expect(resolveTarget({ agent: 'codex', scope: 'project', cwd: '/proj' }))
      .toBe(path.join('/proj', '.codex', 'skills'));
  });
  it('openclaw user', () => {
    expect(resolveTarget({ agent: 'openclaw', scope: 'user', cwd: '/x' }))
      .toBe(path.join(home, '.openclaw', 'skills'));
  });
  it('openclaw project uses workspace skills/', () => {
    expect(resolveTarget({ agent: 'openclaw', scope: 'project', cwd: '/proj' }))
      .toBe(path.join('/proj', 'skills'));
  });
  it('generic user', () => {
    expect(resolveTarget({ agent: 'generic', scope: 'user', cwd: '/x' }))
      .toBe(path.join(home, '.smskill', 'skills'));
  });
  it('generic project', () => {
    expect(resolveTarget({ agent: 'generic', scope: 'project', cwd: '/proj' }))
      .toBe(path.join('/proj', 'skills'));
  });
  it('--dir override wins', () => {
    expect(resolveTarget({ agent: 'claude', scope: 'user', cwd: '/proj', dir: '/custom/path' }))
      .toBe('/custom/path');
  });
  it('rejects unknown agent', () => {
    // @ts-expect-error testing invalid input
    expect(() => resolveTarget({ agent: 'bogus', scope: 'user', cwd: '/x' })).toThrow(/agent/);
  });
  it('rejects unknown scope', () => {
    // @ts-expect-error testing invalid input
    expect(() => resolveTarget({ agent: 'claude', scope: 'bogus', cwd: '/x' })).toThrow(/scope/);
  });
});
```

- [ ] **Step 2: Run, verify fails**

```bash
cd cli && npm test -- target
```

- [ ] **Step 3: Implement**

```typescript
// cli/src/core/target.ts
import os from 'node:os';
import path from 'node:path';

export type Agent = 'claude' | 'codex' | 'openclaw' | 'generic';
export type Scope = 'user' | 'project';

export interface ResolveTargetInput {
  agent: Agent;
  scope: Scope;
  cwd: string;
  dir?: string;
}

const VALID_AGENTS: Agent[] = ['claude', 'codex', 'openclaw', 'generic'];
const VALID_SCOPES: Scope[] = ['user', 'project'];

export function resolveTarget(input: ResolveTargetInput): string {
  if (input.dir) return path.resolve(input.dir);
  if (!VALID_AGENTS.includes(input.agent)) {
    throw new Error(`unknown agent: ${input.agent}`);
  }
  if (!VALID_SCOPES.includes(input.scope)) {
    throw new Error(`unknown scope: ${input.scope}`);
  }
  const home = os.homedir();
  const { agent, scope, cwd } = input;
  if (agent === 'claude') {
    return scope === 'user'
      ? path.join(home, '.claude', 'skills')
      : path.join(cwd, '.claude', 'skills');
  }
  if (agent === 'codex') {
    return scope === 'user'
      ? path.join(home, '.codex', 'skills')
      : path.join(cwd, '.codex', 'skills');
  }
  if (agent === 'openclaw') {
    return scope === 'user'
      ? path.join(home, '.openclaw', 'skills')
      : path.join(cwd, 'skills');
  }
  // generic
  return scope === 'user'
    ? path.join(home, '.smskill', 'skills')
    : path.join(cwd, 'skills');
}
```

- [ ] **Step 4: Run, verify passes**

```bash
cd cli && npm test -- target
```

Expected: all 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/core/target.ts cli/test/core/target.test.ts
git commit -m "feat(cli): target.resolveTarget agent/scope matrix"
```

---

### Task 7: `config` (load/save + env merge)

**Files:**
- Create: `cli/src/core/config.ts`
- Create: `cli/test/core/config.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// cli/test/core/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, saveConfig, configPath, maskToken, DEFAULTS } from '../../src/core/config';

let tmpHome: string;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'smskill-cfg-'));
  process.env.SMSKILL_HOME = tmpHome;
  for (const k of ['SMSKILL_API_BASE_URL', 'SMSKILL_TOKEN', 'SMSKILL_TEAM_ID', 'SMSKILL_AGENT', 'SMSKILL_SCOPE']) {
    delete process.env[k];
  }
});

afterEach(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
  delete process.env.SMSKILL_HOME;
});

describe('loadConfig', () => {
  it('returns defaults when no file and no env', () => {
    const c = loadConfig();
    expect(c.apiBaseUrl).toBe(DEFAULTS.apiBaseUrl);
    expect(c.defaultAgent).toBe('claude');
    expect(c.defaultScope).toBe('user');
    expect(c.token).toBeUndefined();
  });

  it('reads file values', () => {
    saveConfig({ apiBaseUrl: 'https://x', token: 'lst_aaa', defaultTeamId: 5 });
    const c = loadConfig();
    expect(c.apiBaseUrl).toBe('https://x');
    expect(c.token).toBe('lst_aaa');
    expect(c.defaultTeamId).toBe(5);
  });

  it('env overrides file', () => {
    saveConfig({ apiBaseUrl: 'https://file' });
    process.env.SMSKILL_API_BASE_URL = 'https://env';
    process.env.SMSKILL_AGENT = 'codex';
    const c = loadConfig();
    expect(c.apiBaseUrl).toBe('https://env');
    expect(c.defaultAgent).toBe('codex');
  });

  it('saves config with 0600 perms', () => {
    saveConfig({ token: 'lst_secret' });
    const stat = fs.statSync(configPath());
    expect(stat.mode & 0o777).toBe(0o600);
  });
});

describe('maskToken', () => {
  it('masks long tokens', () => {
    expect(maskToken('lst_abc12345xyz789')).toBe('lst_abc12345••••');
  });
  it('returns empty mask for short input', () => {
    expect(maskToken('short')).toBe('••••');
  });
  it('handles undefined', () => {
    expect(maskToken(undefined)).toBe('(not set)');
  });
});
```

- [ ] **Step 2: Run, verify fails**

```bash
cd cli && npm test -- config
```

- [ ] **Step 3: Implement**

```typescript
// cli/src/core/config.ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import type { Agent, Scope } from './target';

export interface Config {
  apiBaseUrl: string;
  token?: string;
  defaultTeamId?: number;
  defaultAgent: Agent;
  defaultScope: Scope;
}

const FileSchema = z.object({
  apiBaseUrl: z.string().url().optional(),
  token: z.string().startsWith('lst_').optional(),
  defaultTeamId: z.number().int().positive().optional(),
  defaultAgent: z.enum(['claude', 'codex', 'openclaw', 'generic']).optional(),
  defaultScope: z.enum(['user', 'project']).optional(),
}).partial();

export const DEFAULTS: Config = {
  apiBaseUrl: 'http://localhost:8080',
  defaultAgent: 'claude',
  defaultScope: 'user',
};

export function smskillHome(): string {
  return process.env.SMSKILL_HOME || path.join(os.homedir(), '.smskill');
}

export function configPath(): string {
  return path.join(smskillHome(), 'config.json');
}

function readFile(): Partial<Config> {
  const p = configPath();
  if (!fs.existsSync(p)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return FileSchema.parse(raw) as Partial<Config>;
  } catch (e) {
    throw new Error(`config file at ${p} is invalid: ${(e as Error).message}`);
  }
}

function readEnv(): Partial<Config> {
  const out: Partial<Config> = {};
  if (process.env.SMSKILL_API_BASE_URL) out.apiBaseUrl = process.env.SMSKILL_API_BASE_URL;
  if (process.env.SMSKILL_TOKEN) out.token = process.env.SMSKILL_TOKEN;
  if (process.env.SMSKILL_TEAM_ID) {
    const n = Number(process.env.SMSKILL_TEAM_ID);
    if (Number.isInteger(n) && n > 0) out.defaultTeamId = n;
  }
  if (process.env.SMSKILL_AGENT) out.defaultAgent = process.env.SMSKILL_AGENT as Agent;
  if (process.env.SMSKILL_SCOPE) out.defaultScope = process.env.SMSKILL_SCOPE as Scope;
  return out;
}

export function loadConfig(): Config {
  const file = readFile();
  const env = readEnv();
  return { ...DEFAULTS, ...file, ...env };
}

export function saveConfig(partial: Partial<Config>): void {
  const dir = smskillHome();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  } else {
    fs.chmodSync(dir, 0o700);
  }
  const existing = readFile();
  const next = { ...existing, ...partial };
  // strip undefined keys so unset works via { token: undefined } if we ever need it
  for (const k of Object.keys(next) as (keyof Config)[]) {
    if (next[k] === undefined) delete next[k];
  }
  const p = configPath();
  fs.writeFileSync(p, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
  fs.chmodSync(p, 0o600);
}

export function unsetConfigKey(key: keyof Config): void {
  const existing = readFile();
  delete (existing as Record<string, unknown>)[key];
  const p = configPath();
  if (Object.keys(existing).length === 0) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return;
  }
  fs.writeFileSync(p, JSON.stringify(existing, null, 2) + '\n', { mode: 0o600 });
  fs.chmodSync(p, 0o600);
}

export function maskToken(token: string | undefined): string {
  if (!token) return '(not set)';
  if (token.length < 12) return '••••';
  return token.slice(0, 12) + '••••';
}
```

- [ ] **Step 4: Run, verify passes**

```bash
cd cli && npm test -- config
```

Expected: all 7 config tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/core/config.ts cli/test/core/config.test.ts
git commit -m "feat(cli): config load/save + env merge + token masking"
```

---

### Task 8: `lockfile` (central installed.json)

**Files:**
- Create: `cli/src/core/lockfile.ts`
- Create: `cli/test/core/lockfile.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// cli/test/core/lockfile.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readLockfile, upsertEntry, removeEntry, findEntries, lockfilePath, type LockEntry } from '../../src/core/lockfile';

let tmpHome: string;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'smskill-lock-'));
  process.env.SMSKILL_HOME = tmpHome;
});

afterEach(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
  delete process.env.SMSKILL_HOME;
});

function makeEntry(over: Partial<LockEntry> = {}): LockEntry {
  return {
    slug: 'weather-helper',
    name: 'Weather Helper',
    version: '1.0.0',
    agent: 'claude',
    scope: 'user',
    path: '/Users/x/.claude/skills/weather-helper',
    source: 'skillstack',
    apiBaseUrl: 'http://localhost:8080',
    installedAt: '2026-05-22T00:00:00Z',
    ...over,
  };
}

describe('lockfile', () => {
  it('returns empty list when file missing', () => {
    expect(readLockfile().entries).toEqual([]);
  });

  it('upsert appends new entries', () => {
    upsertEntry(makeEntry({ slug: 'a' }));
    upsertEntry(makeEntry({ slug: 'b' }));
    expect(readLockfile().entries.map(e => e.slug)).toEqual(['a', 'b']);
  });

  it('upsert overwrites by (slug,agent,scope,path)', () => {
    upsertEntry(makeEntry({ version: '1.0.0' }));
    upsertEntry(makeEntry({ version: '2.0.0' }));
    const lock = readLockfile();
    expect(lock.entries).toHaveLength(1);
    expect(lock.entries[0].version).toBe('2.0.0');
  });

  it('upsert keeps separate rows when only agent differs', () => {
    upsertEntry(makeEntry({ agent: 'claude' }));
    upsertEntry(makeEntry({ agent: 'codex', path: '/Users/x/.codex/skills/weather-helper' }));
    expect(readLockfile().entries).toHaveLength(2);
  });

  it('removeEntry deletes by composite key', () => {
    upsertEntry(makeEntry({ slug: 'a' }));
    upsertEntry(makeEntry({ slug: 'b' }));
    const removed = removeEntry({ slug: 'a', agent: 'claude', scope: 'user', path: makeEntry({ slug: 'a' }).path });
    expect(removed).toBe(true);
    expect(readLockfile().entries.map(e => e.slug)).toEqual(['b']);
  });

  it('removeEntry returns false on miss', () => {
    expect(removeEntry({ slug: 'nope', agent: 'claude', scope: 'user', path: '/x' })).toBe(false);
  });

  it('findEntries filters by slug', () => {
    upsertEntry(makeEntry({ slug: 'a' }));
    upsertEntry(makeEntry({ slug: 'b' }));
    expect(findEntries({ slug: 'a' }).map(e => e.slug)).toEqual(['a']);
  });

  it('findEntries filters by agent and scope', () => {
    upsertEntry(makeEntry({ slug: 'a', agent: 'claude', scope: 'user' }));
    upsertEntry(makeEntry({ slug: 'a', agent: 'codex', scope: 'user', path: '/p2' }));
    upsertEntry(makeEntry({ slug: 'a', agent: 'claude', scope: 'project', path: '/p3' }));
    expect(findEntries({ slug: 'a', agent: 'claude' })).toHaveLength(2);
    expect(findEntries({ slug: 'a', agent: 'claude', scope: 'user' })).toHaveLength(1);
  });

  it('findEntries filters by suite ref via.suite', () => {
    upsertEntry(makeEntry({ slug: 'a', via: { suite: '1/pack', suiteId: 9 } }));
    upsertEntry(makeEntry({ slug: 'b' }));
    expect(findEntries({ suite: '1/pack' }).map(e => e.slug)).toEqual(['a']);
  });

  it('writes lockfile with 0600 perms', () => {
    upsertEntry(makeEntry());
    const mode = fs.statSync(lockfilePath()).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});
```

- [ ] **Step 2: Run, verify fails**

```bash
cd cli && npm test -- lockfile
```

- [ ] **Step 3: Implement**

```typescript
// cli/src/core/lockfile.ts
import fs from 'node:fs';
import path from 'node:path';
import { smskillHome } from './config';
import type { Agent, Scope } from './target';

export interface LockEntry {
  slug: string;
  name: string;
  version: string;
  agent: Agent;
  scope: Scope;
  path: string;
  source: 'skillstack';
  apiBaseUrl: string;
  downloadPath?: string;
  installedAt: string;
  via?: { suite: string; suiteId: number };
}

interface LockFile {
  version: 1;
  entries: LockEntry[];
}

export function lockfilePath(): string {
  return path.join(smskillHome(), 'installed.json');
}

function ensureHome(): void {
  const dir = smskillHome();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
}

export function readLockfile(): LockFile {
  const p = lockfilePath();
  if (!fs.existsSync(p)) return { version: 1, entries: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (raw && raw.version === 1 && Array.isArray(raw.entries)) return raw;
    throw new Error('schema mismatch');
  } catch (e) {
    throw new Error(`lockfile at ${p} is invalid: ${(e as Error).message}`);
  }
}

function writeLockfile(lock: LockFile): void {
  ensureHome();
  const p = lockfilePath();
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(lock, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, p);
  fs.chmodSync(p, 0o600);
}

function sameKey(a: LockEntry, b: { slug: string; agent: Agent; scope: Scope; path: string }): boolean {
  return a.slug === b.slug && a.agent === b.agent && a.scope === b.scope && a.path === b.path;
}

export function upsertEntry(entry: LockEntry): void {
  const lock = readLockfile();
  const idx = lock.entries.findIndex(e => sameKey(e, entry));
  if (idx >= 0) lock.entries[idx] = entry;
  else lock.entries.push(entry);
  writeLockfile(lock);
}

export function removeEntry(key: { slug: string; agent: Agent; scope: Scope; path: string }): boolean {
  const lock = readLockfile();
  const before = lock.entries.length;
  lock.entries = lock.entries.filter(e => !sameKey(e, key));
  if (lock.entries.length === before) return false;
  writeLockfile(lock);
  return true;
}

export interface FindFilter {
  slug?: string;
  agent?: Agent;
  scope?: Scope;
  suite?: string;
}

export function findEntries(filter: FindFilter): LockEntry[] {
  const lock = readLockfile();
  return lock.entries.filter(e => {
    if (filter.slug && e.slug !== filter.slug) return false;
    if (filter.agent && e.agent !== filter.agent) return false;
    if (filter.scope && e.scope !== filter.scope) return false;
    if (filter.suite && e.via?.suite !== filter.suite) return false;
    return true;
  });
}
```

- [ ] **Step 4: Run, verify passes**

```bash
cd cli && npm test -- lockfile
```

Expected: all 10 lockfile tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/core/lockfile.ts cli/test/core/lockfile.test.ts
git commit -m "feat(cli): central lockfile with composite-key upsert/remove/find"
```

---

### Task 9: `api` (axios client + envelope unwrap)

**Files:**
- Create: `cli/src/types/api.ts`
- Create: `cli/src/core/api.ts`
- Create: `cli/src/core/errors.ts`
- Create: `cli/test/core/api.test.ts`

- [ ] **Step 1: Write DTO mirrors**

```typescript
// cli/src/types/api.ts
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PageResult<T> {
  records: T[];
  total: number;
  current: number;
  size: number;
}

export interface SkillCard {
  id: number;
  slug: string;
  name: string;
  shortDesc?: string;
  version?: string;
  installs?: number;
  stars?: number;
  safety?: string;
  visibility?: string;
  status?: string;
  team?: string;
  tags?: string[];
}

export interface SkillDetail extends SkillCard {
  catName?: string;
  updated?: string;
  publishedAt?: string;
}

export interface SkillVersionItem {
  version: string;
  note?: string;
  date?: string;
  installs?: number;
  latest?: boolean;
}

export interface SkillInSuite {
  id: number;
  slug: string;
  name: string;
  version: string;
  position: number;
  installs?: number;
}

export interface SuiteListItem {
  id: number;
  slug: string;
  name: string;
  desc?: string;
  visibility?: string;
  skills?: number;
  installs?: number;
  updatedAt?: string;
}

export interface SuiteDetail {
  id: number;
  slug: string;
  name: string;
  desc?: string;
  teamId: number;
  teamSlug?: string;
  teamName?: string;
  visibility?: string;
  installs?: number;
  skillsCount?: number;
  skills: SkillInSuite[];
}
```

- [ ] **Step 2: Write `errors.ts`**

```typescript
// cli/src/core/errors.ts
export type ExitCode = 0 | 1 | 2 | 3;

export class CliError extends Error {
  constructor(public readonly exitCode: ExitCode, message: string) {
    super(message);
  }
}

export const userError = (m: string) => new CliError(1, m);
export const networkError = (m: string) => new CliError(2, m);
export const fsError = (m: string) => new CliError(3, m);
```

- [ ] **Step 3: Write the failing test**

```typescript
// cli/test/core/api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApi } from '../../src/core/api';
import { CliError } from '../../src/core/errors';

interface MockResp { status: number; data: unknown; }

function mockAxios(resps: MockResp[]) {
  const calls: Array<{ method: string; url: string; headers: Record<string, string> }> = [];
  let i = 0;
  return {
    calls,
    request: vi.fn(async (cfg: { method: string; url: string; headers?: Record<string, string> }) => {
      calls.push({ method: cfg.method, url: cfg.url, headers: cfg.headers ?? {} });
      const r = resps[i++];
      if (!r) throw new Error('mock exhausted');
      if (r.status >= 400) {
        const err = new Error(`HTTP ${r.status}`) as Error & { response?: unknown };
        err.response = { status: r.status, data: r.data };
        throw err;
      }
      return { status: r.status, data: r.data };
    }),
  };
}

describe('api', () => {
  it('unwraps ApiResponse envelope on 200', async () => {
    const ax = mockAxios([{ status: 200, data: { code: 0, message: 'ok', data: { id: 1, name: 'x' } } }]);
    const api = createApi({ baseUrl: 'http://x', token: undefined, axios: ax });
    const out = await api.get<{ id: number; name: string }>('/api/skills/x');
    expect(out).toEqual({ id: 1, name: 'x' });
    expect(ax.calls[0].url).toBe('http://x/api/skills/x');
    expect(ax.calls[0].headers.Authorization).toBeUndefined();
  });

  it('attaches Bearer when token present', async () => {
    const ax = mockAxios([{ status: 200, data: { code: 0, message: 'ok', data: null } }]);
    const api = createApi({ baseUrl: 'http://x', token: 'lst_abc', axios: ax });
    await api.get('/api/skills/x');
    expect(ax.calls[0].headers.Authorization).toBe('Bearer lst_abc');
  });

  it('maps 401/40110 to CliError exit 2', async () => {
    const ax = mockAxios([{ status: 401, data: { code: 40110, message: 'token失效', data: null } }]);
    const api = createApi({ baseUrl: 'http://x', token: 'lst_x', axios: ax });
    await expect(api.get('/api/skills/x')).rejects.toBeInstanceOf(CliError);
    await expect(api.get('/api/skills/x').catch(e => (e as CliError).exitCode)).resolves.toBe(2);
  });

  it('maps non-zero envelope code on 200 to CliError exit 2', async () => {
    const ax = mockAxios([{ status: 200, data: { code: 40300, message: '无权', data: null } }]);
    const api = createApi({ baseUrl: 'http://x', token: 'lst_x', axios: ax });
    await expect(api.get('/api/skills/x')).rejects.toThrow(/40300/);
  });

  it('downloadBytes returns raw buffer', async () => {
    const buf = Buffer.from('PK fake zip');
    const ax = {
      request: vi.fn(async () => ({ status: 200, data: buf, headers: { 'content-type': 'application/zip' } })),
    };
    const api = createApi({ baseUrl: 'http://x', token: undefined, axios: ax });
    const out = await api.downloadBytes('/api/skills/x/download');
    expect(out).toEqual(buf);
  });
});
```

- [ ] **Step 4: Run, verify fails**

```bash
cd cli && npm test -- api
```

- [ ] **Step 5: Implement**

```typescript
// cli/src/core/api.ts
import type { ApiResponse } from '../types/api';
import { CliError, networkError } from './errors';

export interface AxiosLike {
  request: (cfg: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    responseType?: 'json' | 'arraybuffer';
    data?: unknown;
    timeout?: number;
    maxContentLength?: number;
  }) => Promise<{ status: number; data: unknown; headers?: Record<string, string> }>;
}

export interface ApiOptions {
  baseUrl: string;
  token?: string;
  axios: AxiosLike;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface Api {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  downloadBytes(path: string): Promise<Buffer>;
}

export function createApi(opts: ApiOptions): Api {
  const timeout = opts.timeoutMs ?? 30_000;
  const maxBytes = opts.maxBytes ?? 64 * 1024 * 1024;

  function headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: 'application/json' };
    if (opts.token) h.Authorization = `Bearer ${opts.token}`;
    return h;
  }

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let resp;
    try {
      resp = await opts.axios.request({
        method,
        url: opts.baseUrl.replace(/\/$/, '') + path,
        headers: headers(),
        data: body,
        timeout,
      });
    } catch (e) {
      const err = e as Error & { response?: { status: number; data: unknown } };
      if (err.response) {
        const envelope = err.response.data as ApiResponse<unknown> | undefined;
        const code = envelope?.code ?? err.response.status;
        const msg = envelope?.message ?? `HTTP ${err.response.status}`;
        throw new CliError(2, `server error ${code}: ${msg}`);
      }
      throw networkError(err.message ?? 'network error');
    }
    const env = resp.data as ApiResponse<T>;
    if (env && typeof env === 'object' && 'code' in env && env.code !== 0) {
      throw new CliError(2, `server error ${env.code}: ${env.message}`);
    }
    return env.data;
  }

  return {
    get: <T>(p: string) => call<T>('GET', p),
    post: <T>(p: string, body?: unknown) => call<T>('POST', p, body),
    async downloadBytes(path: string): Promise<Buffer> {
      try {
        const resp = await opts.axios.request({
          method: 'GET',
          url: opts.baseUrl.replace(/\/$/, '') + path,
          headers: { ...headers(), Accept: 'application/zip, application/octet-stream' },
          responseType: 'arraybuffer',
          timeout,
          maxContentLength: maxBytes,
        });
        const data = resp.data;
        if (Buffer.isBuffer(data)) return data;
        if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data));
        if (data instanceof Uint8Array) return Buffer.from(data);
        throw new Error('unexpected download body type');
      } catch (e) {
        const err = e as Error & { response?: { status: number } };
        if (err.response) {
          throw new CliError(2, `download failed: HTTP ${err.response.status}`);
        }
        throw networkError(err.message ?? 'download failed');
      }
    },
  };
}
```

- [ ] **Step 6: Run, verify passes**

```bash
cd cli && npm test -- api
```

Expected: all 5 api tests PASS.

- [ ] **Step 7: Commit**

```bash
git add cli/src/types/api.ts cli/src/core/api.ts cli/src/core/errors.ts cli/test/core/api.test.ts
git commit -m "feat(cli): axios-backed api client with envelope unwrap + error mapping"
```

---

### Task 10: `install` (download + strip + safe extract)

**Files:**
- Create: `cli/src/core/install.ts`
- Create: `cli/test/core/install.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// cli/test/core/install.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yauzl from 'yauzl';
import { extractStrippedZip, InstallError } from '../../src/core/install';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'smskill-inst-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

// Build a tiny zip in-memory using node:zlib + central directory? Too messy.
// We'll write a real zip via yauzl's sibling — but yauzl is read-only. Use a fixture builder.
import { ZipBuilder } from './zipBuilder';

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
    const zip = new ZipBuilder()
      .add('weather-helper-1.0.0/../../etc/evil', 'x')
      .build();
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
});
```

Also create a small fixture builder:

```typescript
// cli/test/core/zipBuilder.ts
import { createWriteStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

/** Build a zip from in-memory entries by writing them to a temp dir and invoking the system `zip` binary. */
export class ZipBuilder {
  private entries: Array<{ name: string; data: string }> = [];
  add(name: string, data: string): this { this.entries.push({ name, data }); return this; }
  build(): Buffer {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zb-'));
    try {
      for (const e of this.entries) {
        const full = path.join(tmp, e.name);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, e.data);
      }
      const out = path.join(os.tmpdir(), `zb-${Date.now()}.zip`);
      execFileSync('zip', ['-r', '-q', out, '.'], { cwd: tmp });
      const buf = fs.readFileSync(out);
      fs.unlinkSync(out);
      return buf;
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}
```

> Note: this fixture uses the system `zip` binary, which is universally available on macOS/Linux. If running on CI without `zip`, install it. Avoid hand-rolling zip format in test fixtures.

- [ ] **Step 2: Run, verify fails**

```bash
cd cli && npm test -- install
```

- [ ] **Step 3: Implement**

```typescript
// cli/src/core/install.ts
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
    zip.on('error', reject);
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

function detectTopLevelDir(entries: ZipEntry[]): string {
  const tops = new Set<string>();
  for (const e of entries) {
    const seg = e.fileName.split('/')[0];
    if (seg) tops.add(seg);
  }
  if (tops.size !== 1) {
    throw new InstallError(`expected a single top-level directory in the zip, got ${tops.size}: [${[...tops].join(', ')}]`);
  }
  return [...tops][0];
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
  const entries = await listEntries(buf);
  const top = detectTopLevelDir(entries);
  const root = path.resolve(targetDir);

  // Pre-flight: ensure SKILL.md exists post-strip
  const stripped = entries
    .filter(e => !e.isDirectory)
    .map(e => stripTop(e.fileName, top))
    .filter(Boolean);
  if (!stripped.includes('SKILL.md')) {
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
```

- [ ] **Step 4: Run, verify passes**

```bash
cd cli && npm test -- install
```

Expected: all 4 install tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/core/install.ts cli/test/core/install.test.ts cli/test/core/zipBuilder.ts
git commit -m "feat(cli): zip download stripping + zip-slip-safe extract"
```

---

### Task 11: Render helpers

**Files:**
- Create: `cli/src/render/log.ts`
- Create: `cli/src/render/table.ts`

> Lightweight, no separate tests — they're thin wrappers exercised by command smoke tests later.

- [ ] **Step 1: Create `log.ts`**

```typescript
// cli/src/render/log.ts
import chalk from 'chalk';
import ora, { type Ora } from 'ora';

export const ok = (msg: string) => console.log(chalk.green('✓ ') + msg);
export const fail = (msg: string) => console.error(chalk.red('✖ ') + msg);
export const warn = (msg: string) => console.error(chalk.yellow('⚠ ') + msg);
export const info = (msg: string) => console.log(msg);

export function spinner(text: string): Ora {
  return ora(text).start();
}
```

- [ ] **Step 2: Create `table.ts`**

```typescript
// cli/src/render/table.ts
import Table from 'cli-table3';

export function renderTable(head: string[], rows: Array<Array<string | number>>): string {
  const t = new Table({ head, style: { head: ['cyan'] } });
  for (const r of rows) t.push(r.map(c => String(c ?? '')));
  return t.toString();
}
```

- [ ] **Step 3: Type-check**

```bash
cd cli && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add cli/src/render/log.ts cli/src/render/table.ts
git commit -m "feat(cli): render helpers (log + table)"
```

---

## Phase D — Commands

### Task 12: `config` command

**Files:**
- Create: `cli/src/commands/config.ts`
- Modify: `cli/src/cli.ts`

- [ ] **Step 1: Implement `commands/config.ts`**

```typescript
// cli/src/commands/config.ts
import { Command } from 'commander';
import { loadConfig, saveConfig, unsetConfigKey, configPath, maskToken, DEFAULTS } from '../core/config';
import type { Config } from '../core/config';
import { createApi } from '../core/api';
import axios from 'axios';
import { ok, fail, info, warn } from '../render/log';
import { userError, CliError } from '../core/errors';

const VALID_KEYS = ['apiBaseUrl', 'token', 'defaultTeamId', 'defaultAgent', 'defaultScope'] as const;

function castValue(key: string, raw: string): unknown {
  if (key === 'defaultTeamId') {
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) throw userError('defaultTeamId must be a positive integer');
    return n;
  }
  return raw;
}

export function registerConfig(root: Command): void {
  const cfg = root.command('config').description('Read or write smskill config');

  cfg.command('set <key> <value>')
    .description(`set one of: ${VALID_KEYS.join(', ')}`)
    .action((key: string, value: string) => {
      if (!(VALID_KEYS as readonly string[]).includes(key)) {
        throw userError(`unknown config key: ${key}`);
      }
      saveConfig({ [key]: castValue(key, value) } as Partial<Config>);
      ok(`config.${key} updated`);
    });

  cfg.command('get [key]')
    .option('--show', 'reveal token in plain text', false)
    .description('print one key or all config')
    .action((key: string | undefined, options: { show: boolean }) => {
      const c = loadConfig();
      if (key) {
        if (!(VALID_KEYS as readonly string[]).includes(key)) throw userError(`unknown key: ${key}`);
        const v = (c as Record<string, unknown>)[key];
        if (key === 'token' && !options.show) info(maskToken(c.token));
        else info(v === undefined ? '(not set)' : String(v));
        return;
      }
      const masked = options.show ? c : { ...c, token: maskToken(c.token) };
      info(JSON.stringify(masked, null, 2));
    });

  cfg.command('unset <key>')
    .description('remove a config key')
    .action((key: string) => {
      if (!(VALID_KEYS as readonly string[]).includes(key)) throw userError(`unknown key: ${key}`);
      unsetConfigKey(key as keyof Config);
      ok(`config.${key} cleared`);
    });

  cfg.command('path')
    .description('print config file path')
    .action(() => info(configPath()));

  cfg.command('check')
    .description('verify apiBaseUrl + token by hitting /api/skills and a skill detail')
    .action(async () => {
      const c = loadConfig();
      if (c.apiBaseUrl.startsWith('http://')) warn('apiBaseUrl uses http://; private deploys only');
      const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
      try {
        const page = await api.get<{ records?: Array<{ slug: string }> }>(`/api/skills?size=1&page=1`);
        ok(`apiBaseUrl OK (${c.apiBaseUrl})`);
        if (!c.token) { warn('no token configured; only public endpoints will work'); return; }
        const sample = page?.records?.[0]?.slug;
        if (!sample) { warn('no skills available to probe token; please ask an admin to publish one'); return; }
        await api.get(`/api/skills/${sample}`);
        ok('token OK');
      } catch (e) {
        if (e instanceof CliError) { fail(e.message); throw e; }
        fail(String(e));
        throw e;
      }
    });
}
```

- [ ] **Step 2: Wire into `cli.ts`**

Replace the entire contents of `cli/src/cli.ts` with the block below. **The shebang must be the literal first line of the file** — no leading comment, no blank line.

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { registerConfig } from './commands/config';
import { CliError } from './core/errors';

async function main(): Promise<void> {
  const program = new Command();
  program.name('smskill').description('SkillStack terminal client').version('0.1.0');
  registerConfig(program);
  await program.parseAsync();
}

main().catch((e: unknown) => {
  if (e instanceof CliError) {
    console.error(`✖ ${e.message}`);
    process.exit(e.exitCode);
  }
  console.error(`✖ ${(e as Error).message ?? e}`);
  process.exit(2);
});
```

> tsup preserves the shebang in the bundled output and marks `dist/cli.js` as executable, so `npm link` produces a working local-development `smskill` command. For normal users, `smskill` is published to npm and should be installed with `npm install -g smskill`.

- [ ] **Step 3: Verify build + manual smoke**

```bash
cd cli
npx tsc --noEmit
SMSKILL_HOME=/tmp/smskill-smoke-$$ npm run dev -- config set apiBaseUrl http://localhost:8080
SMSKILL_HOME=/tmp/smskill-smoke-$$ npm run dev -- config get
SMSKILL_HOME=/tmp/smskill-smoke-$$ npm run dev -- config path
rm -rf /tmp/smskill-smoke-*
```

Expected: each command succeeds; `config get` masks token; `config path` prints `/tmp/smskill-smoke-*/config.json`.

- [ ] **Step 4: Commit**

```bash
git add cli/src/commands/config.ts cli/src/cli.ts
git commit -m "feat(cli): config set/get/unset/path/check commands"
```

---

### Task 13: `search` command

**Files:**
- Create: `cli/src/commands/search.ts`
- Modify: `cli/src/cli.ts`

- [ ] **Step 1: Implement**

```typescript
// cli/src/commands/search.ts
import axios from 'axios';
import { Command } from 'commander';
import { loadConfig } from '../core/config';
import { createApi } from '../core/api';
import { renderTable } from '../render/table';
import { info } from '../render/log';
import type { PageResult, SkillCard } from '../types/api';

export function registerSearch(root: Command): void {
  root.command('search [query...]')
    .description('Search the public skill plaza')
    .option('--limit <n>', 'page size', '20')
    .option('--json', 'output raw JSON', false)
    .action(async (queryArr: string[], opts: { limit: string; json: boolean }) => {
      const c = loadConfig();
      const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
      const q = (queryArr || []).join(' ').trim();
      const limit = Math.max(1, Math.min(100, Number(opts.limit) || 20));
      const params = new URLSearchParams({ size: String(limit), page: '1' });
      if (q) params.set('keyword', q);
      const page = await api.get<PageResult<SkillCard>>(`/api/skills?${params.toString()}`);
      if (opts.json) { console.log(JSON.stringify(page, null, 2)); return; }
      const rows = (page.records ?? []).map(s => [
        s.slug, s.name, s.version ?? '-', s.installs ?? 0, s.stars ?? 0, s.safety ?? '-', s.team ?? '-',
      ]);
      info(renderTable(['slug', 'name', 'version', 'installs', 'stars', 'safety', 'team'], rows));
      info(`(${rows.length} of ${page.total} results)`);
    });
}
```

- [ ] **Step 2: Wire into `cli.ts`**

Add the import and call:

```typescript
import { registerSearch } from './commands/search';
// ...
registerSearch(program);
```

- [ ] **Step 3: Type-check**

```bash
cd cli && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Manual smoke (requires backend running on localhost:8080)**

```bash
cd cli && npm run dev -- search
cd cli && npm run dev -- search weather
cd cli && npm run dev -- search --json --limit 5
```

Expected: table or JSON output. If backend isn't running, smoke is skipped and the task is considered done on type-check + structure.

- [ ] **Step 5: Commit**

```bash
git add cli/src/commands/search.ts cli/src/cli.ts
git commit -m "feat(cli): search command against /api/skills"
```

---

### Task 14: `info` command

**Files:**
- Create: `cli/src/commands/info.ts`
- Modify: `cli/src/cli.ts`

- [ ] **Step 1: Implement**

```typescript
// cli/src/commands/info.ts
import axios from 'axios';
import { Command } from 'commander';
import { loadConfig } from '../core/config';
import { createApi } from '../core/api';
import { renderTable } from '../render/table';
import { info } from '../render/log';
import type { SkillDetail, SkillVersionItem } from '../types/api';
import { parseSkillRef } from '../core/skillRef';

export function registerInfo(root: Command): void {
  root.command('info <slug>')
    .description('Show skill details + recent versions')
    .action(async (slugArg: string) => {
      const { slug } = parseSkillRef(slugArg);
      const c = loadConfig();
      const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
      const [detail, versions] = await Promise.all([
        api.get<SkillDetail>(`/api/skills/${encodeURIComponent(slug)}`),
        api.get<SkillVersionItem[]>(`/api/skills/${encodeURIComponent(slug)}/versions`),
      ]);
      info(`${detail.name} (${detail.slug})`);
      info(`  team: ${detail.team ?? '-'}    visibility: ${detail.visibility ?? '-'}    safety: ${detail.safety ?? '-'}`);
      if (detail.shortDesc) info(`  ${detail.shortDesc}`);
      info('');
      const rows = versions.slice(0, 5).map(v => [
        v.latest ? `${v.version} *` : v.version,
        v.date ?? '-',
        v.installs ?? 0,
        (v.note ?? '').slice(0, 60),
      ]);
      info(renderTable(['version', 'date', 'installs', 'note'], rows));
    });
}
```

- [ ] **Step 2: Wire into `cli.ts`**

```typescript
import { registerInfo } from './commands/info';
// ...
registerInfo(program);
```

- [ ] **Step 3: Type-check**

```bash
cd cli && npx tsc --noEmit
```

- [ ] **Step 4: Manual smoke (optional)**

```bash
cd cli && npm run dev -- info some-public-slug
```

- [ ] **Step 5: Commit**

```bash
git add cli/src/commands/info.ts cli/src/cli.ts
git commit -m "feat(cli): info command (detail + versions)"
```

---

### Task 15: `install` command

**Files:**
- Create: `cli/src/commands/install.ts`
- Modify: `cli/src/cli.ts`

- [ ] **Step 1: Implement**

```typescript
// cli/src/commands/install.ts
import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { loadConfig } from '../core/config';
import { createApi } from '../core/api';
import { extractStrippedZip, clearTargetDir } from '../core/install';
import { upsertEntry, type LockEntry } from '../core/lockfile';
import { resolveTarget, type Agent, type Scope } from '../core/target';
import { parseSkillRef } from '../core/skillRef';
import type { SkillDetail } from '../types/api';
import { ok, warn } from '../render/log';
import { userError } from '../core/errors';

export interface InstallOptions {
  agent: Agent;
  scope: Scope;
  dir?: string;
  force: boolean;
  viaSuite?: { suite: string; suiteId: number };
}

export async function installSkill(slugArg: string, opts: InstallOptions): Promise<{ slug: string; version: string; installPath: string }> {
  const { slug, version } = parseSkillRef(slugArg);
  const c = loadConfig();
  const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });

  const detail = await api.get<SkillDetail>(`/api/skills/${encodeURIComponent(slug)}`);
  const targetRoot = resolveTarget({ agent: opts.agent, scope: opts.scope, cwd: process.cwd(), dir: opts.dir });
  const installPath = path.join(targetRoot, slug);

  if (fs.existsSync(installPath)) {
    if (!opts.force) {
      throw userError(`install path already exists: ${installPath} (use --force or run "smskill remove ${slug}")`);
    }
    clearTargetDir(installPath);
  }
  fs.mkdirSync(targetRoot, { recursive: true });

  const dlPath = `/api/skills/${encodeURIComponent(slug)}/download${version ? `?version=${encodeURIComponent(version)}` : ''}`;
  const buf = await api.downloadBytes(dlPath);
  await extractStrippedZip(buf, installPath);

  const effectiveVersion = version ?? detail.version ?? 'unknown';
  const entry: LockEntry = {
    slug,
    name: detail.name,
    version: effectiveVersion,
    agent: opts.agent,
    scope: opts.scope,
    path: installPath,
    source: 'skillstack',
    apiBaseUrl: c.apiBaseUrl,
    downloadPath: dlPath,
    installedAt: new Date().toISOString(),
    ...(opts.viaSuite ? { via: opts.viaSuite } : {}),
  };
  upsertEntry(entry);

  try { await api.post(`/api/skills/${detail.id}/install`, {}); }
  catch { warn(`installed locally but failed to bump install counter on server`); }

  return { slug, version: effectiveVersion, installPath };
}

export function registerInstall(root: Command): void {
  root.command('install <slug>')
    .description('Install a skill into the chosen agent directory')
    .option('--agent <agent>', 'claude | codex | openclaw | generic')
    .option('--scope <scope>', 'user | project')
    .option('--dir <dir>', 'override install root entirely')
    .option('--force', 'overwrite existing install', false)
    .action(async (slug: string, opts: { agent?: string; scope?: string; dir?: string; force: boolean }) => {
      const c = loadConfig();
      const agent = (opts.agent ?? c.defaultAgent) as Agent;
      const scope = (opts.scope ?? c.defaultScope) as Scope;
      const res = await installSkill(slug, { agent, scope, dir: opts.dir, force: opts.force });
      ok(`Installed ${res.slug}@${res.version} → ${res.installPath} (agent=${agent}, scope=${scope})`);
    });
}
```

- [ ] **Step 2: Wire into `cli.ts`**

```typescript
import { registerInstall } from './commands/install';
// ...
registerInstall(program);
```

- [ ] **Step 3: Type-check**

```bash
cd cli && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add cli/src/commands/install.ts cli/src/cli.ts
git commit -m "feat(cli): install command with agent/scope target + lockfile write"
```

---

### Task 16: `list` command

**Files:**
- Create: `cli/src/commands/list.ts`
- Modify: `cli/src/cli.ts`

- [ ] **Step 1: Implement**

```typescript
// cli/src/commands/list.ts
import fs from 'node:fs';
import { Command } from 'commander';
import { findEntries } from '../core/lockfile';
import { renderTable } from '../render/table';
import { info } from '../render/log';
import type { Agent, Scope } from '../core/target';

export function registerList(root: Command): void {
  root.command('list')
    .description('List installed skills (from central lockfile)')
    .option('--agent <agent>')
    .option('--scope <scope>')
    .option('--suite <ref>', 'filter by via.suite ref, e.g. "1/onboarding-pack"')
    .action((opts: { agent?: string; scope?: string; suite?: string }) => {
      const rows = findEntries({
        agent: opts.agent as Agent | undefined,
        scope: opts.scope as Scope | undefined,
        suite: opts.suite,
      });
      if (rows.length === 0) { info('No skills installed yet.'); return; }
      const out = rows.map(e => [
        e.slug,
        e.version,
        e.agent,
        e.scope,
        fs.existsSync(e.path) ? e.path : `${e.path}  [missing]`,
        e.installedAt.slice(0, 19),
      ]);
      info(renderTable(['slug', 'version', 'agent', 'scope', 'path', 'installedAt'], out));
    });
}
```

- [ ] **Step 2: Wire into `cli.ts`**

```typescript
import { registerList } from './commands/list';
// ...
registerList(program);
```

- [ ] **Step 3: Type-check + smoke**

```bash
cd cli && npx tsc --noEmit
SMSKILL_HOME=/tmp/smskill-smoke-$$ npm run dev -- list
rm -rf /tmp/smskill-smoke-*
```

Expected: "No skills installed yet."

- [ ] **Step 4: Commit**

```bash
git add cli/src/commands/list.ts cli/src/cli.ts
git commit -m "feat(cli): list command with agent/scope/suite filters"
```

---

### Task 17: `remove` command

**Files:**
- Create: `cli/src/commands/remove.ts`
- Modify: `cli/src/cli.ts`

- [ ] **Step 1: Implement**

```typescript
// cli/src/commands/remove.ts
import fs from 'node:fs';
import { Command } from 'commander';
import { findEntries, removeEntry } from '../core/lockfile';
import { ok, warn } from '../render/log';
import { userError } from '../core/errors';
import type { Agent, Scope } from '../core/target';

export function registerRemove(root: Command): void {
  root.command('remove <slug>')
    .description('Uninstall a skill (deletes target directory + lockfile entry)')
    .option('--agent <agent>')
    .option('--scope <scope>')
    .action((slug: string, opts: { agent?: string; scope?: string }) => {
      const matches = findEntries({
        slug,
        agent: opts.agent as Agent | undefined,
        scope: opts.scope as Scope | undefined,
      });
      if (matches.length === 0) {
        throw userError(`no installed skill matches "${slug}". Run "smskill list" to see installed skills.`);
      }
      if (matches.length > 1) {
        const hint = matches.map(m => `  ${m.slug} (agent=${m.agent}, scope=${m.scope}, path=${m.path})`).join('\n');
        throw userError(`multiple matches for "${slug}"; narrow with --agent / --scope:\n${hint}`);
      }
      const e = matches[0];
      if (fs.existsSync(e.path)) {
        try { fs.rmSync(e.path, { recursive: true, force: true }); }
        catch (err) { warn(`failed to remove directory ${e.path}: ${(err as Error).message}`); }
      }
      removeEntry({ slug: e.slug, agent: e.agent, scope: e.scope, path: e.path });
      ok(`Removed ${e.slug} (agent=${e.agent}, scope=${e.scope})`);
    });
}
```

- [ ] **Step 2: Wire into `cli.ts`**

```typescript
import { registerRemove } from './commands/remove';
// ...
registerRemove(program);
```

- [ ] **Step 3: Type-check**

```bash
cd cli && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add cli/src/commands/remove.ts cli/src/cli.ts
git commit -m "feat(cli): remove command with composite-key disambiguation"
```

---

### Task 18: `suite list` / `suite info` / `suite install`

**Files:**
- Create: `cli/src/commands/suite.ts`
- Modify: `cli/src/cli.ts`

- [ ] **Step 1: Implement**

```typescript
// cli/src/commands/suite.ts
import axios from 'axios';
import { Command } from 'commander';
import { loadConfig } from '../core/config';
import { createApi } from '../core/api';
import { renderTable } from '../render/table';
import { ok, fail, info, warn } from '../render/log';
import { parseSuiteRef } from '../core/suiteRef';
import { installSkill } from './install';
import type { PageResult, SuiteListItem, SuiteDetail } from '../types/api';
import type { Agent, Scope } from '../core/target';
import { userError, CliError } from '../core/errors';

export function registerSuite(root: Command): void {
  const suite = root.command('suite').description('Browse and install suites');

  suite.command('list')
    .description('List suites for the configured team')
    .option('--team <id>', 'override teamId')
    .option('--limit <n>', 'page size', '20')
    .option('--json', 'raw JSON output', false)
    .action(async (opts: { team?: string; limit: string; json: boolean }) => {
      const c = loadConfig();
      const teamId = opts.team ? Number(opts.team) : c.defaultTeamId;
      if (!teamId || !Number.isInteger(teamId) || teamId <= 0) {
        throw userError('teamId required: pass --team <id> or set defaultTeamId');
      }
      const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
      const limit = Math.max(1, Math.min(100, Number(opts.limit) || 20));
      const page = await api.get<PageResult<SuiteListItem>>(`/api/teams/${teamId}/suites?size=${limit}&page=1`);
      if (opts.json) { console.log(JSON.stringify(page, null, 2)); return; }
      const rows = (page.records ?? []).map(s => [
        s.slug, s.name, s.skills ?? 0, s.installs ?? 0, s.visibility ?? '-', (s.updatedAt ?? '').slice(0, 10),
      ]);
      info(renderTable(['slug', 'name', 'skills', 'installs', 'visibility', 'updated'], rows));
    });

  suite.command('info <ref>')
    .description('Show suite metadata + included skills. ref = "<teamId>/<slug>" or "<slug>"')
    .action(async (ref: string) => {
      const c = loadConfig();
      const { teamId, slug } = parseSuiteRef(ref, c.defaultTeamId);
      const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
      const detail = await api.get<SuiteDetail>(`/api/teams/${teamId}/suites/by-slug/${encodeURIComponent(slug)}`);
      info(`${detail.name} (${detail.slug}, team=${detail.teamSlug ?? detail.teamId})`);
      info(`  visibility: ${detail.visibility ?? '-'}    installs: ${detail.installs ?? 0}    skills: ${detail.skillsCount ?? detail.skills.length}`);
      if (detail.desc) info(`  ${detail.desc}`);
      info('');
      const rows = detail.skills.map(s => [s.position, s.slug, s.name, s.version, s.installs ?? 0]);
      info(renderTable(['pos', 'slug', 'name', 'version', 'installs'], rows));
    });

  suite.command('install <ref>')
    .description('Install every skill in the suite to the same target')
    .option('--agent <agent>')
    .option('--scope <scope>')
    .option('--dir <dir>')
    .option('--force', 'use --force per skill', false)
    .option('--no-continue-on-error', 'stop at first failed skill (default: continue)')
    .action(async (ref: string, opts: { agent?: string; scope?: string; dir?: string; force: boolean; continueOnError: boolean }) => {
      const c = loadConfig();
      const agent = (opts.agent ?? c.defaultAgent) as Agent;
      const scope = (opts.scope ?? c.defaultScope) as Scope;
      const { teamId, slug } = parseSuiteRef(ref, c.defaultTeamId);
      const api = createApi({ baseUrl: c.apiBaseUrl, token: c.token, axios });
      const detail = await api.get<SuiteDetail>(`/api/teams/${teamId}/suites/by-slug/${encodeURIComponent(slug)}`);

      const continueOnError = opts.continueOnError !== false;
      const suiteRef = `${teamId}/${slug}`;
      info(`Installing suite ${suiteRef} (${detail.skills.length} skills)`);

      const succeeded: string[] = [];
      const failed: Array<{ slug: string; reason: string }> = [];
      for (const s of detail.skills) {
        const slugAtVersion = s.version ? `${s.slug}@${s.version}` : s.slug;
        try {
          const r = await installSkill(slugAtVersion, {
            agent, scope, dir: opts.dir, force: opts.force,
            viaSuite: { suite: suiteRef, suiteId: detail.id },
          });
          ok(`  ${slugAtVersion} → ${r.installPath}`);
          succeeded.push(slugAtVersion);
        } catch (e) {
          const reason = (e as Error).message ?? String(e);
          fail(`  ${slugAtVersion}   ${reason}`);
          failed.push({ slug: slugAtVersion, reason });
          if (!continueOnError) break;
        }
      }

      try { await api.post(`/api/suites/${detail.id}/install`, {}); }
      catch { warn('installed locally but failed to bump suite install counter on server'); }

      info('');
      info(`Summary: ${succeeded.length} installed, ${failed.length} failed`);
      if (failed.length > 0) throw new CliError(2, `${failed.length} skill(s) failed to install`);
    });
}
```

- [ ] **Step 2: Wire into `cli.ts`**

```typescript
import { registerSuite } from './commands/suite';
// ...
registerSuite(program);
```

- [ ] **Step 3: Type-check**

```bash
cd cli && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add cli/src/commands/suite.ts cli/src/cli.ts
git commit -m "feat(cli): suite list/info/install commands with best-effort install"
```

---

## Phase E — Docs + local distribution

### Task 19: Update root docs + cli README

**Files:**
- Modify: `AGENT.md`
- Modify: `cli/README.md`

- [ ] **Step 1: Update `AGENT.md` — add `cli/` to 主要目录**

In the "## 主要目录" section, after the `frontend/` entries and before `backend/`, add:

```markdown
- `cli/`：终端 CLI `smskill`（Node + TS），用于消费 SkillStack。
- `cli/src/commands/`：命令实现（config / search / info / install / list / remove / suite）。
- `cli/src/core/`：API 客户端、配置、lockfile、安装解压、agent 目标矩阵。
```

In the "## 技术栈" section, in the **前端**/**后端** lists' tail, append a new bullet group:

```markdown

CLI：

- Node.js 20+
- TypeScript 5.x
- commander, axios, zod, chalk, ora, cli-table3, yauzl
- vitest
```

- [ ] **Step 2: Replace `cli/README.md` with the full manual**

```markdown
# smskill

SkillStack terminal client. See `docs/superpowers/specs/2026-05-22-smskill-cli-design.md` for the design.

## Install

用户安装推荐使用 npm 官方仓库：

```bash
npm install -g smskill
smskill --version
```

临时运行：

```bash
npx smskill@latest --version
```

本地开发当前工作区版本：

```bash
cd cli
npm install
npm run build
npm link        # link current workspace for local development
```

## Configure

```bash
smskill config set apiBaseUrl https://your.server
smskill config set token lst_xxxxxxxx
smskill config set defaultTeamId 1
smskill config check
```

Or use env vars (CI-friendly):

```bash
export SMSKILL_API_BASE_URL=https://your.server
export SMSKILL_TOKEN=lst_xxxxxxxx
export SMSKILL_TEAM_ID=1
```

## Install a skill

```bash
smskill install weather-helper                       # → ~/.claude/skills/weather-helper/
smskill install weather-helper --scope project       # → ./.claude/skills/weather-helper/
smskill install weather-helper --agent codex         # → ~/.codex/skills/weather-helper/
smskill install weather-helper --agent openclaw --scope project   # → ./skills/weather-helper/
```

| agent | scope=user | scope=project |
|---|---|---|
| claude | `~/.claude/skills/<slug>/` | `<cwd>/.claude/skills/<slug>/` |
| codex | `~/.codex/skills/<slug>/` | `<cwd>/.codex/skills/<slug>/` |
| openclaw | `~/.openclaw/skills/<slug>/` | `<cwd>/skills/<slug>/` |
| generic | `~/.smskill/skills/<slug>/` | `<cwd>/skills/<slug>/` |

## Install a suite

```bash
smskill suite list
smskill suite info 1/onboarding-pack
smskill suite install 1/onboarding-pack              # best-effort; failed skills don't roll back
smskill suite install onboarding-pack --no-continue-on-error
```

## Manage installed skills

```bash
smskill list
smskill list --agent claude
smskill list --suite 1/onboarding-pack
smskill remove weather-helper --agent claude
```

## Configuration file

Stored at `~/.smskill/config.json` (mode 0600). Lockfile at `~/.smskill/installed.json`.

## Self-signed TLS

Set `NODE_EXTRA_CA_CERTS=/path/to/ca.pem` before running smskill.
```

- [ ] **Step 3: Verify**

```bash
cat AGENT.md | grep -A2 "cli/"
cat cli/README.md | head -20
```

- [ ] **Step 4: Commit**

```bash
git add AGENT.md cli/README.md
git commit -m "docs(cli): document smskill in AGENT.md + cli/README.md"
```

---

### Task 20: End-to-end smoke

**Files:**
- (no source changes; documentation of manual verification)

- [ ] **Step 1: Start backend + frontend (verify backend is up)**

```bash
./scripts/services.sh start
curl -s http://localhost:8080/swagger-ui.html | head -1
```

- [ ] **Step 2: Create a PAT through the web UI**

Browse `http://localhost:5173`, log in, go to team settings → tokens, create a token named `cli-smoke`. Copy the `lst_...` secret.

- [ ] **Step 3: Configure smskill**

```bash
cd cli
npm install -g smskill
npm view smskill version --registry=https://registry.npmjs.org/
smskill --version
smskill config set apiBaseUrl http://localhost:8080
smskill config set token lst_xxxxxxxx
smskill config set defaultTeamId 1
smskill config check
```

本地开发当前工作区版本时才使用：

```bash
npm run build
npm link
smskill --version
```

Expected: `✓ apiBaseUrl OK` and `✓ token OK`.

- [ ] **Step 4: Smoke each command**

Replace `weather-helper` with an actual public approved slug in your DB:

```bash
smskill search weather
smskill info weather-helper
smskill install weather-helper                          # → ~/.claude/skills/weather-helper/
ls ~/.claude/skills/weather-helper/                     # SKILL.md should be there
smskill list
smskill install weather-helper --agent codex
ls ~/.codex/skills/weather-helper/
smskill list
smskill remove weather-helper --agent codex
smskill remove weather-helper --agent claude
smskill list                                            # back to empty
```

- [ ] **Step 5: Smoke suite install (requires a suite in DB)**

```bash
smskill suite list
smskill suite info 1/<suite-slug>
smskill suite install 1/<suite-slug>
smskill list --suite 1/<suite-slug>
```

- [ ] **Step 6: Commit a verification log (optional)**

If you want to leave evidence:

```bash
echo "smskill e2e smoke passed $(date)" >> cli/SMOKE.log
git add cli/SMOKE.log
git commit -m "test(cli): end-to-end smoke logged"
```

If the smoke surfaces real issues, fix them in a new commit before claiming the plan complete.

---

## Done criteria

- All tasks above checked off.
- `cd backend && mvn -Dtest=JwtAuthFilterPatTest test` passes (8 tests).
- `cd cli && npm test` passes (all unit tests across core/).
- `cd cli && npx tsc --noEmit` clean.
- E2E smoke (Task 20) walked through end-to-end and worked against a running stack.

If any of these doesn't hold, the plan isn't done — fix before claiming.
