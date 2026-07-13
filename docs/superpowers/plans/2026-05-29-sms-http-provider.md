# SMS Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable SMS provider support for SMS login with both generic HTTP and built-in Lingyang Chaoxin providers.

**Architecture:** Keep one dedicated SMS provider configuration row and dispatch sending by `providerType`. HTTP stores all headers in one typed list; Lingyang Chaoxin stores ordinary provider config in `extraJson` and sensitive credentials in `secretJson`, with all sensitive values masked on read.

**Tech Stack:** Java 17, Spring Boot 3.2, MyBatis Plus, Flyway, React 18, TypeScript, TanStack Query.

---

### Task 1: Align Storage And DTO Contract

**Files:**
- Modify: `backend/src/main/resources/db/migration/V20260529_122041__sms_provider_config.sql`
- Modify: `backend/src/main/java/com/skillstack/auth/sms/entity/SmsProviderConfig.java`
- Modify: `backend/src/main/java/com/skillstack/auth/sms/dto/AdminSmsProviderVO.java`
- Modify: `backend/src/main/java/com/skillstack/auth/sms/dto/UpdateSmsProviderReq.java`
- Modify: `backend/src/test/java/com/skillstack/auth/sms/SmsProviderServiceTest.java`

- [x] Replace `secret_headers_json` with `extra_json` and `secret_json`.
- [x] Replace `secretHeadersJson`/`secretHeadersSet` DTO fields with masked `headersJson`, `extraJson`, `secretJson`, and `secretJsonSet`.
- [x] Add tests for single `headersJson` masking and preserving sensitive Header values.
- [x] Add tests for provider-specific `secretJson` masking and preserving existing values.

### Task 2: Refactor SmsProviderService

**Files:**
- Modify: `backend/src/main/java/com/skillstack/auth/sms/SmsProviderService.java`
- Modify: `backend/src/test/java/com/skillstack/auth/sms/SmsProviderServiceTest.java`

- [x] Validate `providerType` as `HTTP` or `LINGYANG_CHAOXIN`.
- [x] For `HTTP`, require endpoint URL and body template when enabled.
- [x] For `LINGYANG_CHAOXIN`, require endpoint URL, `appId`, `accessKey`, `accessSecret`, `signName`, and `templateCode` when enabled.
- [x] Mask sensitive Header values and provider secrets on admin read/audit.
- [x] Preserve masked sensitive values when update payload leaves them blank; clear only when explicit clear marker is sent.

### Task 3: Update HTTP Sender

**Files:**
- Modify: `backend/src/main/java/com/skillstack/auth/sms/HttpSmsSender.java`
- Modify: `backend/src/test/java/com/skillstack/auth/sms/HttpSmsSenderTest.java`

- [x] Parse `headersJson` as an array of Header entries.
- [x] Apply both ordinary and sensitive Header entries from the same field.
- [x] Keep body template and response success checks unchanged.

### Task 4: Add Lingyang Chaoxin Sender And Dispatch

**Files:**
- Create: `backend/src/main/java/com/skillstack/auth/sms/LingyangChaoxinSignatureUtil.java`
- Create: `backend/src/main/java/com/skillstack/auth/sms/LingyangChaoxinSmsSender.java`
- Create: `backend/src/main/java/com/skillstack/auth/sms/SmsSenderDispatcher.java`
- Create: `backend/src/test/java/com/skillstack/auth/sms/LingyangChaoxinSmsSenderTest.java`
- Modify: `backend/src/main/java/com/skillstack/auth/service/AuthService.java`
- Modify: `backend/src/test/java/com/skillstack/auth/service/AuthServiceTest.java`

- [x] Add deterministic signature test for sorted MD5 signing.
- [x] Add sender test verifying request query, `Authorization` header, body, and success response parsing.
- [x] Dispatch by `providerType`.
- [x] Keep disabled-provider dev behavior.

### Task 5: Update Frontend API And UI

**Files:**
- Modify: `frontend/src/api/endpoints.ts`
- Modify: `frontend/src/api/admin.ts`
- Modify: `frontend/src/pages/admin/OAuth.tsx`

- [x] Update TypeScript API types to remove `secretHeadersJson`.
- [x] Add provider selector for `HTTP 自定义` and `瓴羊超信`.
- [x] Replace Header JSON textareas with editable Header rows containing name, value, and type.
- [x] Add Lingyang Chaoxin fields without version wording.
- [x] Preserve masked sensitive values unless the user replaces or clears them.

### Task 6: Verify

**Commands:**
- `cd backend && mvn -q -Dtest=SmsProviderServiceTest,HttpSmsSenderTest,LingyangChaoxinSmsSenderTest test`
- `cd backend && mvn -q -DskipTests compile`
- `cd frontend && npm run lint`

- [x] Record backend targeted test result.
- [x] Record backend compile result.
- [x] Record frontend type check result.

**Verification result:** targeted SMS backend tests passed, backend compile passed, frontend type check passed. `AuthServiceTest` was also included in the final targeted backend run. Lingyang `timeout` is applied through a per-request `RestTemplate` when configured, otherwise the shared project `RestTemplate` is reused.

### Self-Review Checklist

- [x] Does `providerType` use exactly `HTTP` and `LINGYANG_CHAOXIN`?
- [x] Are there no user-facing or field names that mention unavailable protocol versions?
- [x] Is HTTP sensitive Header storage handled only through `headersJson`?
- [x] Are sensitive values masked on admin read and excluded from audit payload?
- [x] Are private helpers placed at the end of existing Java classes?
- [x] Are unrelated working tree changes left untouched?
