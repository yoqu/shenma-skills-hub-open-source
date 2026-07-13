# Prompt Library Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Prompt library module described in `docs/superpowers/specs/2026-05-25-prompt-library-design.md` to production-grade behavior across backend, frontend, CLI, database migrations, and verification.

**Architecture:** Add Prompt as a first-class domain (`prompt` package) while incrementally abstracting shared cross-cutting flows (`review`, `suite`, `asset reviews`) by `target_type`. Keep existing Skill APIs compatible during migration; new Prompt APIs use dedicated endpoints and shared materialization/resolve services.

**Tech Stack:** Java 17 + Spring Boot + MyBatis Plus + MySQL/Flyway, React 18 + TypeScript + TanStack Query + current component system, Node 20 TypeScript CLI with commander/axios/vitest.

**Execution Status (2026-05-25):** Implemented across backend, frontend, and CLI. Prompt references resolve to the latest `APPROVED` version only; historical versions are read-only for review and rollback context. Review dispatch was implemented inside the existing `ReviewService` flow instead of introducing standalone materializer classes, preserving the same workflow semantics. The frontend editor now uses Tiptap with a custom Prompt mention node and Markdown serializer/parser, while the stored source of truth remains Markdown.

---

## File Map

Backend:

- Create `backend/src/main/resources/db/migration/V26__prompt_library.sql`: prompts, prompt_versions, prompt_refs, prompt_tags, asset reviews/stars/replies, review target columns, suite mixed item columns.
- Create `backend/src/main/java/com/skillstack/prompt/**`: entity, DTO, mapper, service, controller for prompt CRUD, resolve, download, review materialization.
- Modify `backend/src/main/java/com/skillstack/review/**`: add target fields and dispatch approve by `targetType`.
- Modify `backend/src/main/java/com/skillstack/suite/**`: support mixed `SKILL | PROMPT` suite items while keeping old `skills` projection.
- Modify `backend/src/main/java/com/skillstack/skill/service/SkillReviewService.java` and related controller wiring: move rating aggregation to generic asset review service while preserving Skill endpoint behavior.
- Modify `backend/src/main/java/com/skillstack/common/security/JwtAuthFilter.java`: allow PAT Prompt consumption routes only.

Frontend:

- Modify `frontend/src/api/endpoints.ts` and `frontend/src/api/data.ts`: add Prompt API contracts and queries.
- Create `frontend/src/pages/create/CreatePrompt.tsx`: create/edit flow with Markdown editor and reference check.
- Create `frontend/src/pages/team/admin/Prompts.tsx` and `frontend/src/pages/team/member/Prompts.tsx`: team Prompt library.
- Create `frontend/src/pages/public/PromptDetail.tsx` and Prompt detail subcomponents.
- Modify `frontend/src/pages/public/Home.tsx`, `frontend/src/pages/public/Plaza.tsx`, `frontend/src/router.tsx`, `frontend/src/components/chrome/TeamSidebar.tsx`: navigation and Prompt tab.
- Modify `frontend/src/pages/team/admin/Reviews.tsx` and review pane/list components: target type filtering and Prompt detail rendering.
- Modify `frontend/src/pages/team/admin/Suites.tsx` and suite editor components: mixed assets.

CLI:

- Create `cli/src/commands/prompt.ts`: `smskill prompt search/info/get`.
- Modify `cli/src/commands/suite.ts`: install mixed suite items and export prompts.
- Modify `cli/src/types/api.ts`, `cli/src/core/lockfile.ts`, `cli/src/cli.ts`.

Verification:

- Add backend tests for prompt resolve, prompt review approve, visibility, cycles, mixed suite, asset review.
- Add frontend type/build checks and targeted vitest for prompt reference serialization helpers.
- Add CLI vitest tests for prompt export path and raw/resolved behavior.

---

### Task 1: Backend Schema And Prompt Core

**Files:**
- Create: `backend/src/main/resources/db/migration/V26__prompt_library.sql`
- Create: `backend/src/main/java/com/skillstack/prompt/entity/Prompt.java`
- Create: `backend/src/main/java/com/skillstack/prompt/entity/PromptVersion.java`
- Create: `backend/src/main/java/com/skillstack/prompt/entity/PromptRef.java`
- Create: `backend/src/main/java/com/skillstack/prompt/entity/PromptTag.java`
- Create: `backend/src/main/java/com/skillstack/prompt/mapper/PromptMapper.java`
- Create: `backend/src/main/java/com/skillstack/prompt/mapper/PromptVersionMapper.java`
- Create: `backend/src/main/java/com/skillstack/prompt/mapper/PromptRefMapper.java`
- Create: `backend/src/main/java/com/skillstack/prompt/mapper/PromptTagMapper.java`
- Create: `backend/src/main/java/com/skillstack/prompt/dto/CreatePromptReq.java`
- Create: `backend/src/main/java/com/skillstack/prompt/dto/PromptCard.java`
- Create: `backend/src/main/java/com/skillstack/prompt/dto/PromptDetail.java`
- Create: `backend/src/main/java/com/skillstack/prompt/dto/PromptVersionItem.java`
- Create: `backend/src/main/java/com/skillstack/prompt/dto/PromptResolveResult.java`
- Create: `backend/src/main/java/com/skillstack/prompt/service/PromptMarkdownService.java`
- Create: `backend/src/main/java/com/skillstack/prompt/service/PromptResolveService.java`
- Create: `backend/src/main/java/com/skillstack/prompt/service/PromptService.java`
- Create: `backend/src/main/java/com/skillstack/prompt/controller/PromptController.java`

- [x] **Step 1: Write backend core tests first**

Create tests covering:

```text
PromptMarkdownService extracts skillstack://prompt/team/slug references in order.
PromptResolveService expands references to the latest approved version.
PromptResolveService detects cycles.
PromptService rejects PUBLIC prompt references to TEAM_PRIVATE prompt.
```

Run:

```bash
cd backend && mvn -q -Dtest=PromptMarkdownServiceTest,PromptResolveServiceTest test
```

Expected: fail because classes do not exist yet.

- [x] **Step 2: Add V26 migration**

Add schema with:

```sql
CREATE TABLE prompts (...);
CREATE TABLE prompt_versions (...);
CREATE TABLE prompt_refs (...);
CREATE TABLE prompt_tags (...);
ALTER TABLE reviews ADD COLUMN target_type VARCHAR(16) NOT NULL DEFAULT 'SKILL';
ALTER TABLE reviews ADD COLUMN target_id BIGINT DEFAULT NULL;
ALTER TABLE reviews ADD COLUMN display_slug VARCHAR(96) DEFAULT NULL;
ALTER TABLE reviews ADD COLUMN display_name VARCHAR(128) DEFAULT NULL;
ALTER TABLE reviews ADD COLUMN payload_json JSON DEFAULT NULL;
ALTER TABLE suite_items ADD COLUMN item_type VARCHAR(16) NOT NULL DEFAULT 'SKILL';
ALTER TABLE suite_items ADD COLUMN item_id BIGINT DEFAULT NULL;
UPDATE suite_items SET item_type = 'SKILL', item_id = skill_id WHERE item_id IS NULL;
CREATE TABLE asset_reviews (...);
CREATE TABLE asset_review_replies (...);
CREATE TABLE asset_stars (...);
```

Use additive Flyway only; do not edit older migrations.

- [x] **Step 3: Implement Prompt entities, mappers, DTOs**

Follow existing MyBatis Plus entity style with `BaseEntity`.

- [x] **Step 4: Implement PromptMarkdownService and PromptResolveService**

Implement deterministic parsing of:

```markdown
@[label](skillstack://prompt/team-slug/prompt-slug)
```

Resolve recursively to latest approved prompt version, max depth 10, cycle path error as `BusinessException`.

- [x] **Step 5: Implement PromptService and PromptController**

Support:

```http
GET /api/prompts
GET /api/teams/{teamId}/prompts
GET /api/teams/{teamSlug}/prompts/{promptSlug}
GET /api/teams/{teamSlug}/prompts/{promptSlug}/download?raw=false
POST /api/prompts
POST /api/prompts/drafts
POST /api/prompts/{id}/versions
```

Direct publish path only when allowed by team review mode; review-required path creates `reviews(target_type='PROMPT')`.

- [x] **Step 6: Run backend core tests**

Run:

```bash
cd backend && mvn -q -Dtest=PromptMarkdownServiceTest,PromptResolveServiceTest test
```

Expected: pass.

### Task 2: Review Dispatch And Prompt Materialization

**Files:**
- Modify: `backend/src/main/java/com/skillstack/review/entity/Review.java`
- Modify: `backend/src/main/java/com/skillstack/review/dto/ReviewDetail.java`
- Modify: `backend/src/main/java/com/skillstack/review/dto/ReviewListItem.java`
- Modify: `backend/src/main/java/com/skillstack/review/mapper/ReviewMapper.java`
- Modify: `backend/src/main/java/com/skillstack/review/service/ReviewService.java`
- Create: `backend/src/main/java/com/skillstack/review/service/ReviewMaterializer.java`
- Create: `backend/src/main/java/com/skillstack/review/service/SkillReviewMaterializer.java`
- Create: `backend/src/main/java/com/skillstack/prompt/service/PromptReviewMaterializer.java`

- [x] **Step 1: Write failing review materialization tests**

Test:

```text
Approving PROMPT create review inserts prompts + prompt_versions + prompt_refs.
Rejecting PROMPT review does not create prompt.
Approving SKILL review still behaves as before.
```

Run:

```bash
cd backend && mvn -q -Dtest=ReviewServicePromptTest test
```

Expected: fail because materializer does not exist.

- [x] **Step 2: Add target fields to Review entity and DTOs**

Expose `targetType`, `targetId`, `displaySlug`, `displayName`, `payloadJson`.

- [x] **Step 3: Extract SkillReviewMaterializer**

Move existing Skill approve logic from `ReviewService.approve` into a dedicated materializer without changing behavior.

- [x] **Step 4: Add PromptReviewMaterializer**

Parse `payload_json`, validate refs, materialize Prompt create/version bump in one transaction.

- [x] **Step 5: Dispatch approve by targetType**

`ReviewService.approve` delegates to materializer map. Reject/request changes/withdraw remain generic.

- [x] **Step 6: Run review tests**

Run:

```bash
cd backend && mvn -q -Dtest=ReviewServicePromptTest test
```

Expected: pass.

### Task 3: Suite Mixed Assets And Asset Reviews

**Files:**
- Modify: `backend/src/main/java/com/skillstack/suite/entity/SuiteItem.java`
- Modify: `backend/src/main/java/com/skillstack/suite/dto/SuiteDetail.java`
- Modify: `backend/src/main/java/com/skillstack/suite/dto/SkillInSuite.java`
- Create: `backend/src/main/java/com/skillstack/suite/dto/SuiteAssetItem.java`
- Modify: `backend/src/main/java/com/skillstack/suite/dto/CreateSuiteReq.java`
- Modify: `backend/src/main/java/com/skillstack/suite/dto/UpdateSuiteItemsReq.java`
- Modify: `backend/src/main/java/com/skillstack/suite/service/SuiteService.java`
- Create: `backend/src/main/java/com/skillstack/asset/entity/AssetReview.java`
- Create: `backend/src/main/java/com/skillstack/asset/entity/AssetReviewReply.java`
- Create: `backend/src/main/java/com/skillstack/asset/entity/AssetStar.java`
- Create: `backend/src/main/java/com/skillstack/asset/mapper/AssetReviewMapper.java`
- Create: `backend/src/main/java/com/skillstack/asset/mapper/AssetReviewReplyMapper.java`
- Create: `backend/src/main/java/com/skillstack/asset/mapper/AssetStarMapper.java`
- Create: `backend/src/main/java/com/skillstack/asset/service/AssetReviewService.java`
- Modify: `backend/src/main/java/com/skillstack/skill/service/SkillReviewService.java`
- Modify: `backend/src/main/java/com/skillstack/skill/controller/SkillController.java`
- Modify: `backend/src/main/java/com/skillstack/prompt/controller/PromptController.java`

- [x] **Step 1: Write suite and asset review tests**

Test:

```text
Suite detail returns SKILL and PROMPT items in order.
Public suite hides private prompt for non-member.
Prompt review aggregation does not affect Skill score.
Skill review endpoint still returns previous shape.
```

- [x] **Step 2: Implement mixed suite item DTOs and service SQL**

Keep existing `skills` projection for backward compatibility; add `items`.

- [x] **Step 3: Implement AssetReviewService**

Support `loadSummary`, `submit`, `reply`, `recomputeScore` for target type.

- [x] **Step 4: Wire Skill and Prompt review endpoints**

Preserve existing Skill API shape. Add Prompt review endpoints.

- [x] **Step 5: Run tests**

Run:

```bash
cd backend && mvn -q -Dtest=SuiteMixedAssetsTest,AssetReviewServiceTest test
```

Expected: pass.

### Task 4: CLI Prompt Commands And Mixed Suite Install

**Files:**
- Create: `cli/src/commands/prompt.ts`
- Create: `cli/src/core/promptRef.ts`
- Modify: `cli/src/commands/suite.ts`
- Modify: `cli/src/types/api.ts`
- Modify: `cli/src/core/lockfile.ts`
- Modify: `cli/src/cli.ts`

- [x] **Step 1: Write CLI tests**

Test:

```text
prompt ref parsing supports team/slug and slug with default team.
prompt get writes default expanded md path.
prompt get --raw preserves reference markers.
suite install exports PROMPT items and installs SKILL items.
```

Run:

```bash
cd cli && npm test -- prompt
```

Expected: fail before implementation.

- [x] **Step 2: Implement prompt commands**

Add:

```text
smskill prompt search
smskill prompt info
smskill prompt get
```

- [x] **Step 3: Implement mixed suite install**

Read `SuiteDetail.items`. For `PROMPT`, download `.md`; for `SKILL`, reuse existing install.

- [x] **Step 4: Run CLI tests and build**

Run:

```bash
cd cli && npm test && npm run typecheck && npm run build
```

Expected: pass.

### Task 5: Frontend Prompt UI

**Files:**
- Modify: `frontend/src/api/endpoints.ts`
- Modify: `frontend/src/api/data.ts`
- Create: `frontend/src/pages/create/CreatePrompt.tsx`
- Create: `frontend/src/pages/create/CreatePrompt/promptMarkdown.ts`
- Create: `frontend/src/pages/team/admin/Prompts.tsx`
- Create: `frontend/src/pages/team/member/Prompts.tsx`
- Create: `frontend/src/pages/public/PromptDetail.tsx`
- Modify: `frontend/src/pages/public/Home.tsx`
- Modify: `frontend/src/pages/public/Plaza.tsx`
- Modify: `frontend/src/pages/team/admin/Reviews.tsx`
- Modify: `frontend/src/pages/team/admin/Reviews/ReviewList.tsx`
- Modify: `frontend/src/pages/team/admin/Reviews/ReviewPane.tsx`
- Modify: `frontend/src/pages/team/admin/Suites.tsx`
- Modify: `frontend/src/router.tsx`
- Modify: `frontend/src/components/chrome/TeamSidebar.tsx`

- [x] **Step 1: Write frontend helper tests**

Test Markdown prompt mention serialization and parsing in `CreatePrompt/promptMarkdown.test.ts`.

Status: implemented in `frontend/src/pages/create/CreatePrompt/promptMarkdown.test.ts`, covering mention extraction, Markdown -> Tiptap doc parsing, and Tiptap doc -> Markdown serialization.

- [x] **Step 2: Add Prompt API client and hooks**

Types for `PromptCard`, `PromptDetail`, `PromptResolveResult`, suite `items`.

- [x] **Step 3: Build CreatePrompt**

Use existing UI atoms. Implement Tiptap-based Prompt editor with toolbar controls, custom Prompt mention chip, Markdown preview, reference inspection, validation, and route modes for create / edit profile / submit new version.

- [x] **Step 4: Add Prompt library and detail pages**

Team list, public detail, reviews, download actions.

- [x] **Step 5: Update Home/Plaza tabs and routing**

Add Prompt tab without adding heavy public filters.

- [x] **Step 6: Update review and suite UI**

Type filters, Prompt details, mixed item badges.

- [x] **Step 7: Run frontend tests/build**

Run:

```bash
cd frontend && npm run build
```

Expected: pass.

### Task 6: Security, Integration, Browser Smoke

**Files:**
- Modify: `backend/src/main/java/com/skillstack/common/security/JwtAuthFilter.java`
- Modify: `backend/src/main/java/com/skillstack/common/config/SecurityConfig.java` if route authorization requires it.
- Update: `docs/superpowers/specs/2026-05-25-prompt-library-design.md` only if implementation decisions materially differ.

- [x] **Step 1: Add PAT route tests**

Prompt detail/download/suite mixed detail allowed for PAT; create/edit/review denied.

- [x] **Step 2: Run full backend verification**

Run:

```bash
cd backend && mvn test
```

- [x] **Step 3: Run full frontend and CLI verification**

Run:

```bash
cd frontend && npm run build
cd cli && npm test && npm run build
```

- [x] **Step 4: Start services and browser smoke**

Run:

```bash
./scripts/services.sh restart
./scripts/services.sh status
```

Browser smoke:

```text
Create Prompt -> submit review -> approve -> team Prompt library -> prompt detail -> CLI download path.
Home Prompt tab renders public approved Prompt only.
Suite mixed item page shows Skill and Prompt.
```

- [x] **Step 5: Final completion audit**

Compare implementation against spec section 19 minimum success standards and report any unsupported feature honestly.
