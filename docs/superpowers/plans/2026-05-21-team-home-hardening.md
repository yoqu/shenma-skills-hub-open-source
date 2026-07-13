# Team Home Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make team home pages production-ready by eliminating fake data, fixing navigation, unifying team context, enforcing real role-based permissions, and ensuring all clickable controls have real behavior.

**Architecture:** 
- Phase 1 (foundational, parallel-friendly): Fix team context source, implement sidebar navigation, add backend permission validation
- Phase 2 (depends on Phase 1): Replace URL-based roles with team membership, clean fake metrics from dashboards
- Phase 3 (depends on Phase 1): Fix button actions (navigate, disable, or remove)
- Phase 4 (final polish): Add loading/error/empty states

**Tech Stack:** React + TypeScript (frontend), Spring Boot + MyBatis (backend), existing data hooks and API endpoints

**Parallelization strategy:** Tasks 1-4 can run in parallel. Tasks 5-8 depend on Task 2 being complete; Task 3 depends on Task 1.

---

## Task 1: Unify Team Context Source

**Files:**
- Modify: `frontend/src/hooks/useCurrentTeam.ts`
- Modify: `frontend/src/components/chrome/TopBar.tsx`
- Modify: `frontend/src/pages/team/RoleAware.tsx`
- Modify: `frontend/src/pages/team/admin/Dashboard.tsx`
- Modify: `frontend/src/pages/team/member/Dashboard.tsx`

**Problem:** Team context comes from multiple sources (`myTeams[0]`, URL, local state). When user switches teams via TopBar, workbench data doesn't follow.

**Solution:** Create single `useCurrentTeam()` hook that:
- Returns `{ teamId, teamSlug, role }` from persistent state
- TopBar switching updates this state (not just navigating)
- All team data hooks read from this same source
- Falls back to `myTeams[0]` on initial load, or `NoTeamPage` if empty

**Execution:**

- [ ] **Step 1: Update `useCurrentTeam.ts` to add persistent state**

```typescript
// frontend/src/hooks/useCurrentTeam.ts
import { useEffect, useState } from 'react';
import { useMe } from './useMe';
import { useTeams } from './useTeams';

export function useCurrentTeam() {
  const { data: me } = useMe();
  const { data: teams } = useTeams();
  
  // Use localStorage to persist team selection across page reloads
  const [currentTeamId, setCurrentTeamId] = useState<number | null>(() => {
    const saved = localStorage.getItem('currentTeamId');
    return saved ? parseInt(saved, 10) : null;
  });

  // On initial load, use first team if none selected
  useEffect(() => {
    if (!currentTeamId && teams && teams.length > 0) {
      const firstTeamId = teams[0].id;
      setCurrentTeamId(firstTeamId);
      localStorage.setItem('currentTeamId', firstTeamId.toString());
    }
  }, [teams, currentTeamId]);

  // Get current team object and user role in it
  const currentTeam = teams?.find(t => t.id === currentTeamId);
  const memberInTeam = currentTeam?.members?.find(m => m.handle === me?.handle);
  const role = memberInTeam?.role || undefined;

  return {
    teamId: currentTeamId || null,
    teamSlug: currentTeam?.slug || null,
    teamName: currentTeam?.name || null,
    role: role,
    setCurrentTeamId,
    team: currentTeam || null,
  };
}
```

- [ ] **Step 2: Update TopBar team switcher to call `setCurrentTeamId`**

Find the team select handler in `TopBar.tsx` (currently just navigates):

```typescript
// frontend/src/components/chrome/TopBar.tsx
// In the team selector's onChange handler:
const { setCurrentTeamId } = useCurrentTeam();

const handleTeamChange = (teamId: number) => {
  setCurrentTeamId(teamId);
  localStorage.setItem('currentTeamId', teamId.toString());
  // Navigate will follow automatically via useCurrentTeam dependency
};
```

- [ ] **Step 3: Update `RoleAware.tsx` to use `useCurrentTeam()` instead of URL query**

```typescript
// frontend/src/pages/team/RoleAware.tsx
import { useCurrentTeam } from '../../hooks/useCurrentTeam';

export function RoleAware() {
  const { role, teamId } = useCurrentTeam();
  
  if (!teamId) {
    return <NoTeamPage />;
  }

  if (!role) {
    return <ForbiddenPage teamId={teamId} />;
  }

  // Role is now reliable from team membership, not URL query
  if (role === 'ADMIN' || role === 'OWNER') {
    return <AdminShell />;
  }
  
  return <MemberShell />;
}
```

- [ ] **Step 4: Update Admin Dashboard to use `useCurrentTeam()` instead of hardcoded fallback**

```typescript
// frontend/src/pages/team/admin/Dashboard.tsx
import { useCurrentTeam } from '../../../hooks/useCurrentTeam';

export function AdminDashboard() {
  const { teamId, teamName } = useCurrentTeam();
  // Use teamId and teamName from context, not hardcoded defaults
  
  // All data hooks should be keyed by teamId
  const { data: skills, loading: skillsLoading } = useTeamSkills(teamId);
  const { data: reviews, loading: reviewsLoading } = useTeamReviews(teamId);
  // ... etc
}
```

- [ ] **Step 5: Update Member Dashboard similarly**

```typescript
// frontend/src/pages/team/member/Dashboard.tsx
import { useCurrentTeam } from '../../../hooks/useCurrentTeam';

export function MemberDashboard() {
  const { teamId, teamName } = useCurrentTeam();
  
  const { data: mySubmissions } = useMySubmissions(teamId);
  const { data: teamActivities } = useTeamActivities(teamId);
  // ... etc
}
```

- [ ] **Step 6: Test by switching teams and confirming dashboard updates**

```bash
cd frontend && npm run dev
# Navigate to /team
# Click team selector in TopBar
# Switch to different team
# Verify: dashboard team name, skill count, member count all change
# Refresh page - team context should persist
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useCurrentTeam.ts \
        frontend/src/components/chrome/TopBar.tsx \
        frontend/src/pages/team/RoleAware.tsx \
        frontend/src/pages/team/admin/Dashboard.tsx \
        frontend/src/pages/team/member/Dashboard.tsx
git commit -m "refactor: unify team context source, make team switching update workbench data"
```

---

## Task 2: Fix Left Sidebar Navigation

**Files:**
- Modify: `frontend/src/components/chrome/TeamSidebar.tsx`
- Modify: `frontend/src/pages/team/admin/_shared/AdminShell.tsx`
- Modify: `frontend/src/pages/team/member/_shared/MemberShell.tsx`
- Modify: `frontend/src/router.tsx`

**Problem:** Left sidebar has `onNavigate?.(it.id)` but AdminShell/MemberShell don't pass the callback, so clicks do nothing.

**Solution:** Create route mapping in router, pass navigation callback to sidebar, handle clicks to navigate to correct pages.

**Execution:**

- [ ] **Step 1: Define route mappings in router**

```typescript
// frontend/src/router.tsx
// Add at top level after imports:

export const SIDEBAR_ROUTES = {
  admin: {
    overview: '/team',
    skills: '/team/skills',
    reviews: '/team/reviews',
    members: '/team/members',
    invites: '/team/invites',
    suites: '/team/suites',
    settings: '/team/settings',
  },
  member: {
    overview: '/team',
    skills: '/team/skills',
    mine: '/team/mine',
    members: '/team/members',
    suites: '/team/suites',
    prefs: '/team/prefs',
  },
};
```

- [ ] **Step 2: Update TeamSidebar to accept and use navigation callback**

```typescript
// frontend/src/components/chrome/TeamSidebar.tsx
import { useNavigate } from 'react-router-dom';

interface TeamSidebarProps {
  role?: 'ADMIN' | 'OWNER' | 'MEMBER' | 'VIEWER';
  currentKey?: string;
}

export function TeamSidebar({ role = 'MEMBER', currentKey }: TeamSidebarProps) {
  const navigate = useNavigate();
  const routes = role === 'ADMIN' || role === 'OWNER' 
    ? SIDEBAR_ROUTES.admin 
    : SIDEBAR_ROUTES.member;

  const handleMenuClick = (key: string) => {
    const route = routes[key as keyof typeof routes];
    if (route) {
      navigate(route);
    }
  };

  return (
    <div className="sidebar">
      {Object.entries(routes).map(([key, route]) => (
        <button
          key={key}
          onClick={() => handleMenuClick(key)}
          className={currentKey === key ? 'active' : ''}
        >
          {key}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Update AdminShell to pass current page key and role to sidebar**

```typescript
// frontend/src/pages/team/admin/_shared/AdminShell.tsx
import { useLocation } from 'react-router-dom';
import { useCurrentTeam } from '../../../../hooks/useCurrentTeam';
import { SIDEBAR_ROUTES } from '../../../../router';

export function AdminShell() {
  const { role } = useCurrentTeam();
  const location = useLocation();

  // Determine current key from location
  const currentKey = Object.entries(SIDEBAR_ROUTES.admin).find(
    ([_, path]) => path === location.pathname
  )?.[0];

  return (
    <div className="admin-shell">
      <TeamSidebar role={role as 'ADMIN'} currentKey={currentKey} />
      <div className="content">
        {/* existing content */}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update MemberShell similarly**

```typescript
// frontend/src/pages/team/member/_shared/MemberShell.tsx
import { useLocation } from 'react-router-dom';
import { useCurrentTeam } from '../../../../hooks/useCurrentTeam';
import { SIDEBAR_ROUTES } from '../../../../router';

export function MemberShell() {
  const { role } = useCurrentTeam();
  const location = useLocation();

  const currentKey = Object.entries(SIDEBAR_ROUTES.member).find(
    ([_, path]) => path === location.pathname
  )?.[0];

  return (
    <div className="member-shell">
      <TeamSidebar role={role as 'MEMBER'} currentKey={currentKey} />
      <div className="content">
        {/* existing content */}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Test navigation**

```bash
cd frontend && npm run dev
# Navigate to /team (should see Admin or Member shell based on role)
# Click each sidebar item
# Verify: URL changes, page content updates, current menu item highlights
# Check that each route exists and loads correctly
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/chrome/TeamSidebar.tsx \
        frontend/src/pages/team/admin/_shared/AdminShell.tsx \
        frontend/src/pages/team/member/_shared/MemberShell.tsx \
        frontend/src/router.tsx
git commit -m "fix: left sidebar navigation now routes to correct pages"
```

---

## Task 3: Replace Query-Based Roles with Team Membership (depends on Task 1)

**Files:**
- Delete: `frontend/src/lib/role.ts`
- Modify: `frontend/src/pages/team/RoleAware.tsx`
- Modify: Backend controllers: `ReviewController.java`, `SkillController.java`, `SuiteController.java`

**Problem:** Role is determined by URL query `?as=member`, defaulting to Admin. Not trustworthy for security.

**Solution:** Role comes only from `useCurrentTeam()` which reads team membership. Backend validates permissions on every protected endpoint.

**Frontend Execution:**

- [ ] **Step 1: Remove `frontend/src/lib/role.ts`** (it's no longer used)

```bash
rm frontend/src/lib/role.ts
# Remove any imports of this file from codebase
grep -r "from.*lib/role" frontend/src --include="*.tsx" --include="*.ts"
# Delete those imports
```

- [ ] **Step 2: Verify RoleAware.tsx is already updated (from Task 1)**

RoleAware.tsx should now use `useCurrentTeam()` instead of `useRole()`. If there are any remaining references to `useRole()`, remove them.

- [ ] **Step 3: Update any pages that were reading role from URL**

Search for `?as=member` or `?as=admin` in component code:

```bash
grep -r "as=member\|as=admin\|searchParams.get.*as" frontend/src --include="*.tsx"
```

Remove those query string checks; role now comes from `useCurrentTeam()`.

- [ ] **Step 4: Commit frontend changes**

```bash
git add -A frontend/
git commit -m "refactor: remove URL-based role query, use team membership only"
```

**Backend Execution (can run in parallel):**

- [ ] **Step 5: Add permission check helper to base controller or service**

```java
// backend/src/main/java/com/skillstack/auth/interceptor/TeamAuthInterceptor.java
package com.skillstack.auth.interceptor;

import com.skillstack.auth.entity.User;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.service.TeamService;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public class TeamPermissionHelper {
    
    public static void requireTeamMember(User currentUser, Integer teamId, TeamService teamService) {
        TeamMember member = teamService.getTeamMember(teamId, currentUser.getId());
        if (member == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a team member");
        }
    }
    
    public static void requireTeamAdmin(User currentUser, Integer teamId, TeamService teamService) {
        TeamMember member = teamService.getTeamMember(teamId, currentUser.getId());
        if (member == null || !("ADMIN".equals(member.getRole()) || "OWNER".equals(member.getRole()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
        }
    }
}
```

- [ ] **Step 6: Add permission validation to ReviewController**

```java
// backend/src/main/java/com/skillstack/review/controller/ReviewController.java
@PostMapping("/{reviewId}/approve")
public ReviewDTO approveReview(@PathVariable Integer reviewId) {
    Review review = reviewService.getReview(reviewId);
    User currentUser = getCurrentUser();
    
    // Validate: current user is admin in the review's team
    TeamPermissionHelper.requireTeamAdmin(currentUser, review.getTeamId(), teamService);
    
    return reviewService.approveReview(reviewId, currentUser.getId());
}

@PostMapping("/{reviewId}/reject")
public ReviewDTO rejectReview(@PathVariable Integer reviewId, @RequestBody String reason) {
    Review review = reviewService.getReview(reviewId);
    User currentUser = getCurrentUser();
    
    TeamPermissionHelper.requireTeamAdmin(currentUser, review.getTeamId(), teamService);
    
    return reviewService.rejectReview(reviewId, currentUser.getId(), reason);
}
```

- [ ] **Step 7: Add permission validation to SkillController for team-private skills**

```java
// backend/src/main/java/com/skillstack/skill/controller/SkillController.java
@GetMapping("/team/{teamId}/skills")
public List<SkillDTO> getTeamSkills(@PathVariable Integer teamId) {
    User currentUser = getCurrentUser();
    
    // Validate: current user can view this team's private skills
    TeamPermissionHelper.requireTeamMember(currentUser, teamId, teamService);
    
    return skillService.getTeamSkills(teamId);
}
```

- [ ] **Step 8: Add permission validation to SuiteController for write operations**

```java
// backend/src/main/java/com/skillstack/suite/controller/SuiteController.java
@PostMapping("/team/{teamId}/suites")
public SuiteDTO createSuite(@PathVariable Integer teamId, @RequestBody CreateSuiteReq req) {
    User currentUser = getCurrentUser();
    
    // Validate: current user is admin in this team
    TeamPermissionHelper.requireTeamAdmin(currentUser, teamId, teamService);
    
    return suiteService.createSuite(teamId, req, currentUser);
}

@PutMapping("/{suiteId}")
public SuiteDTO updateSuite(@PathVariable Integer suiteId, @RequestBody UpdateSuiteReq req) {
    Suite suite = suiteService.getSuite(suiteId);
    User currentUser = getCurrentUser();
    
    TeamPermissionHelper.requireTeamAdmin(currentUser, suite.getTeamId(), teamService);
    
    return suiteService.updateSuite(suiteId, req);
}
```

- [ ] **Step 9: Run backend tests to ensure permission checks work**

```bash
cd backend
mvn test -Dtest=ReviewControllerTest,SkillControllerTest,SuiteControllerTest
```

- [ ] **Step 10: Commit backend changes**

```bash
git add backend/src/main/java/com/skillstack/auth/interceptor/TeamPermissionHelper.java \
        backend/src/main/java/com/skillstack/review/controller/ReviewController.java \
        backend/src/main/java/com/skillstack/skill/controller/SkillController.java \
        backend/src/main/java/com/skillstack/suite/controller/SuiteController.java
git commit -m "feat: add backend permission validation for team role boundaries"
```

---

## Task 4: Add Backend Team Permission Tests (parallel to Task 3)

**Files:**
- Create: `backend/src/test/java/com/skillstack/auth/interceptor/TeamPermissionHelperTest.java`
- Modify: `backend/src/test/java/com/skillstack/review/controller/ReviewControllerTest.java`
- Modify: `backend/src/test/java/com/skillstack/skill/controller/SkillControllerTest.java`

**Problem:** Backend controllers don't have tests for permission boundaries.

**Solution:** Write tests that verify:
- Non-members cannot access team data
- Members can read team data
- Only admins can make changes

**Execution:**

- [ ] **Step 1: Create helper test**

```java
// backend/src/test/java/com/skillstack/auth/interceptor/TeamPermissionHelperTest.java
package com.skillstack.auth.interceptor;

import static org.junit.jupiter.api.Assertions.*;
import com.skillstack.auth.entity.User;
import com.skillstack.team.service.TeamService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest
class TeamPermissionHelperTest {

    @Autowired
    private TeamService teamService;

    @Test
    void testRequireTeamMember_WithoutMembership_ThrowsForbidden() {
        User nonMember = new User(); // not in team
        
        assertThrows(ResponseStatusException.class, () -> {
            TeamPermissionHelper.requireTeamMember(nonMember, 1, teamService);
        });
    }

    @Test
    void testRequireTeamAdmin_WithMemberRole_ThrowsForbidden() {
        User member = new User(); // member (not admin) of team
        
        assertThrows(ResponseStatusException.class, () -> {
            TeamPermissionHelper.requireTeamAdmin(member, 1, teamService);
        });
    }

    @Test
    void testRequireTeamAdmin_WithAdminRole_Passes() {
        User admin = new User(); // admin of team
        
        assertDoesNotThrow(() -> {
            TeamPermissionHelper.requireTeamAdmin(admin, 1, teamService);
        });
    }
}
```

- [ ] **Step 2: Add permission test to ReviewControllerTest**

```java
// In backend/src/test/java/com/skillstack/review/controller/ReviewControllerTest.java
@Test
void testApproveReview_WithoutAdminRole_ReturnsForbidden() throws Exception {
    // User is member but not admin of team
    mockAuthentication(memberUser);
    
    mockMvc.perform(post("/reviews/1/approve"))
        .andExpect(status().isForbidden());
}

@Test
void testApproveReview_WithAdminRole_ReturnsOk() throws Exception {
    mockAuthentication(adminUser);
    
    mockMvc.perform(post("/reviews/1/approve"))
        .andExpect(status().isOk());
}
```

- [ ] **Step 3: Add permission test to SkillControllerTest**

```java
// In backend/src/test/java/com/skillstack/skill/controller/SkillControllerTest.java
@Test
void testGetTeamSkills_NonMember_ReturnsForbidden() throws Exception {
    mockAuthentication(nonMemberUser);
    
    mockMvc.perform(get("/skills/team/1/skills"))
        .andExpect(status().isForbidden());
}

@Test
void testGetTeamSkills_WithMembership_ReturnsSkills() throws Exception {
    mockAuthentication(memberUser);
    
    mockMvc.perform(get("/skills/team/1/skills"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(0))));
}
```

- [ ] **Step 4: Run all tests**

```bash
cd backend
mvn test
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/test/java/com/skillstack/auth/interceptor/TeamPermissionHelperTest.java \
        backend/src/test/java/com/skillstack/review/controller/ReviewControllerTest.java \
        backend/src/test/java/com/skillstack/skill/controller/SkillControllerTest.java
git commit -m "test: add permission boundary tests for team access control"
```

---

## Task 5: Clean Admin Dashboard Fake Metrics (depends on Task 1)

**Files:**
- Modify: `frontend/src/pages/team/admin/Dashboard.tsx`

**Problem:** Dashboard shows `CHART_DATA` (fake trends), `WEEKLY_DELTAS` (fake weekly stats), fake team names, hardcoded activity metrics.

**Solution:** Remove all fake data constants. Keep only real data: skill counts, review queue size, member count, activity list.

**Execution:**

- [ ] **Step 1: Identify and remove fake data constants**

```typescript
// frontend/src/pages/team/admin/Dashboard.tsx
// REMOVE these constants entirely:
// const CHART_DATA = [...]  // fake 30-day trend
// const WEEKLY_DELTAS = {...}  // fake weekly stats
```

- [ ] **Step 2: Replace hardcoded trend chart with empty state or remove section**

```typescript
// OLD:
<BarChart data={CHART_DATA} title="安装趋势 · 麓豆前端组所有公开 Skill" />

// NEW: Remove the entire chart section, or replace with:
{/* Chart hidden: no real trend API available */}
```

- [ ] **Step 3: Replace hardcoded stats with real data from API**

```typescript
// OLD:
<StatCard label="活跃成员" value={members.length - 2} /> // fake calculation

// NEW:
const { data: members } = useTeamMembers(teamId);
<StatCard label="团队成员" value={members?.length || 0} />
```

- [ ] **Step 4: Verify only real metrics remain**

Real metrics allowed in spec:
- ✅ Team public skill count
- ✅ Team private skill count  
- ✅ Pending review count
- ✅ Team member count
- ✅ Team activity list
- ✅ Team skill list

Everything else: remove.

```typescript
export function AdminDashboard() {
  const { teamId, teamName } = useCurrentTeam();

  const { data: publicSkills = [] } = useTeamPublicSkills(teamId);
  const { data: privateSkills = [] } = useTeamPrivateSkills(teamId);
  const { data: reviews = [] } = useTeamReviews(teamId);
  const { data: members = [] } = useTeamMembers(teamId);
  const { data: activities = [] } = useTeamActivities(teamId);

  return (
    <div>
      <h1>{teamName} 工作台</h1>
      
      <div className="stats">
        <StatCard label="公开 Skill" value={publicSkills.length} />
        <StatCard label="私有 Skill" value={privateSkills.length} />
        <StatCard label="待审核" value={reviews.length} />
        <StatCard label="团队成员" value={members.length} />
      </div>

      <ActivityList activities={activities} />
      <SkillList skills={[...publicSkills, ...privateSkills]} />
    </div>
  );
}
```

- [ ] **Step 5: Test dashboard**

```bash
cd frontend && npm run dev
# Navigate to /team (as admin)
# Verify: only 4 stats show, numbers match backend
# Verify: no fake trend chart
# Verify: activity list and skill list load
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/team/admin/Dashboard.tsx
git commit -m "fix: remove fake metrics from admin dashboard, keep only real data"
```

---

## Task 6: Clean Member Dashboard & MySubmissions (depends on Task 1)

**Files:**
- Modify: `frontend/src/pages/team/member/Dashboard.tsx`
- Modify: `frontend/src/pages/team/member/MySubmissions/index.tsx`

**Problem:** "My Submissions" falls back to team submissions when user has none. "My Installed Skills" is fake. "Popular This Week" uses wrong terminology.

**Solution:** Show empty state for user's own data. Remove unsupported features. Fix terminology.

**Execution:**

- [ ] **Step 1: Fix MySubmissions to never fallback to team data**

```typescript
// frontend/src/pages/team/member/MySubmissions/index.tsx
export function MySubmissions() {
  const { teamId } = useCurrentTeam();
  const { data: me } = useMe();
  const { data: allReviews = [] } = useTeamReviews(teamId);

  // Filter to only current user's submissions
  const mySubmissions = allReviews.filter(r => r.submittedBy.handle === me?.handle);

  if (mySubmissions.length === 0) {
    return (
      <div className="empty-state">
        <p>还没有提交过 Skill</p>
        <Link to="/create/skill">现在提交</Link>
      </div>
    );
  }

  return (
    <div>
      {mySubmissions.map(submission => (
        <SubmissionCard key={submission.id} submission={submission} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Remove "My Installed Skills" section (no real API)**

```typescript
// OLD in Dashboard.tsx:
<MyInstalledSkills /> // remove entirely

// If you want to keep a placeholder:
{/* "My Installed Skills" requires separate API, not currently available */}
```

- [ ] **Step 3: Rename "Popular This Week" to match actual data source**

```typescript
// OLD:
<SkillList title="本周热门 Skill" />

// NEW (assuming sorted by install count, not by week):
<SkillList title="团队常安装 Skill" />
// OR hide the section if no clear sorting

// If you have true time-windowed data, keep "本周热门"
```

- [ ] **Step 4: Update Member Dashboard to use real data**

```typescript
// frontend/src/pages/team/member/Dashboard.tsx
export function MemberDashboard() {
  const { teamId, teamName } = useCurrentTeam();
  const { data: me } = useMe();

  const { data: mySubmissions = [] } = useMySubmissions(teamId, me?.id);
  const { data: teamActivities = [] } = useTeamActivities(teamId);
  const { data: teamSkills = [] } = useTeamSkills(teamId);
  const { data: suites = [] } = useTeamSuites(teamId);

  return (
    <div>
      <h1>{teamName} 工作台</h1>
      
      <div className="sections">
        <Section title="我的提交">
          {mySubmissions.length === 0 ? (
            <EmptyState message="还没有提交过 Skill" action={<Link to="/create/skill">现在提交</Link>} />
          ) : (
            <ReviewList reviews={mySubmissions} />
          )}
        </Section>

        <Section title="团队动态">
          <ActivityList activities={teamActivities} />
        </Section>

        <Section title="团队 Skill">
          <SkillList skills={teamSkills} />
        </Section>

        <Section title="团队套件">
          <SuiteList suites={suites} />
        </Section>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Test member dashboard**

```bash
cd frontend && npm run dev
# Navigate to /team (as member)
# Sign in as user with no submissions
# Verify: "My Submissions" shows empty state, NOT team submissions
# Verify: no "My Installed Skills" section
# Verify: team activities/skills/suites load correctly
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/team/member/Dashboard.tsx \
        frontend/src/pages/team/member/MySubmissions/index.tsx
git commit -m "fix: remove fallback to team data in member dashboard, add empty states"
```

---

## Task 7: Fix Button Actions Across Team Pages (depends on Task 2)

**Files:**
- Modify: `frontend/src/pages/team/admin/Skills.tsx`
- Modify: `frontend/src/pages/team/admin/Members.tsx`
- Modify: `frontend/src/pages/team/admin/Suites.tsx`
- Modify: `frontend/src/pages/team/member/Prefs.tsx`

**Problem:** Many buttons look clickable but do nothing: "Create Skill", "Invite Member", "Save Preferences", "Leave Team", etc.

**Solution:** Categorize each button as:
1. **Real navigation** → link to existing route
2. **Real action** → call existing API + handle loading/error
3. **Not implemented** → disable or hide

**Execution:**

- [ ] **Step 1: Fix Admin Skills page buttons**

```typescript
// frontend/src/pages/team/admin/Skills.tsx
import { useNavigate } from 'react-router-dom';

export function AdminSkillsPage() {
  const navigate = useNavigate();
  const { teamId } = useCurrentTeam();

  return (
    <div>
      <div className="action-bar">
        {/* Real navigation: create skill has an existing create page */}
        <button onClick={() => navigate('/create/skill')}>
          新增 Skill
        </button>
      </div>

      <SkillList teamId={teamId} />
    </div>
  );
}
```

- [ ] **Step 2: Fix Admin Members page buttons**

```typescript
// frontend/src/pages/team/admin/Members.tsx
export function AdminMembersPage() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="action-bar">
        {/* Real navigation: invites page exists */}
        <button onClick={() => navigate('/team/invites')}>
          邀请成员
        </button>
      </div>

      <MembersList />
    </div>
  );
}
```

- [ ] **Step 3: Fix Admin Suites page buttons**

```typescript
// frontend/src/pages/team/admin/Suites.tsx
export function AdminSuitesPage() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="action-bar">
        {/* Either: link to existing create page, or: hide if no create page exists */}
        <button onClick={() => navigate('/create/suite')} disabled={!hasCreateSuitePage}>
          创建套件
        </button>
      </div>

      <SuitesList />
    </div>
  );
}
```

- [ ] **Step 4: Fix Member Prefs page**

```typescript
// frontend/src/pages/team/member/Prefs.tsx
// Remove or disable all unimplemented features

export function PrefsPage() {
  const { teamId } = useCurrentTeam();

  return (
    <div>
      {/* Keep: notification preferences if API exists, else hide */}
      {/* Keep: profile customization if API exists, else hide */}
      
      {/* Hide: Token section (no API) */}
      {/* Hide: Leave Team button (no API) */}

      {/* If no features have real APIs, show empty state: */}
      <EmptyState message="此页面暂无可用功能" />
    </div>
  );
}
```

- [ ] **Step 5: Audit all team pages for unused buttons**

```bash
cd frontend && grep -r "onClick={().*=>.*{}}\\|disabled\|TODO\|FIXME" src/pages/team --include="*.tsx"
```

For each button found:
- If it navigates to existing page → use `useNavigate`
- If it calls existing API → add mutation + loading state
- Otherwise → disable or hide

- [ ] **Step 6: Test each page**

```bash
cd frontend && npm run dev
# Admin Skills: click "New Skill" → should navigate to /create/skill
# Admin Members: click "Invite" → should navigate to /team/invites
# Admin Suites: click "Create Suite" → should navigate to suite creation
# Member Prefs: verify all buttons either work or are disabled
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/team/admin/Skills.tsx \
        frontend/src/pages/team/admin/Members.tsx \
        frontend/src/pages/team/admin/Suites.tsx \
        frontend/src/pages/team/member/Prefs.tsx
git commit -m "fix: categorize all page buttons as navigate/action/disable"
```

---

## Task 8: Add Production States (Loading/Error/Empty/Forbidden) (depends on Task 1)

**Files:**
- Modify: `frontend/src/hooks/useTeamSkills.ts` and other data hooks
- Modify: All team pages to show states

**Problem:** Pages default to empty list `[]`, can't distinguish loading / error / forbidden / empty.

**Solution:** Each data hook returns `{ data, loading, error, forbidden }`. Pages render appropriate UI for each state.

**Execution:**

- [ ] **Step 1: Update data hook return types**

```typescript
// frontend/src/hooks/useTeamSkills.ts
// (and similar for useTeamReviews, useTeamMembers, etc.)

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  forbidden: boolean;
}

export function useTeamSkills(teamId: number | null): FetchState<Skill[]> {
  const [data, setData] = useState<Skill[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/skills/team/${teamId}`);
        setData(response.data);
        setForbidden(false);
      } catch (err) {
        if ((err as any).response?.status === 403) {
          setForbidden(true);
        } else {
          setError(err as Error);
        }
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [teamId]);

  return { data, loading, error, forbidden };
}
```

- [ ] **Step 2: Create reusable state components**

```typescript
// frontend/src/components/states/DataState.tsx

interface DataStateProps {
  loading?: boolean;
  error?: Error | null;
  forbidden?: boolean;
  empty?: boolean;
  children: React.ReactNode;
}

export function DataState({ loading, error, forbidden, empty, children }: DataStateProps) {
  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (forbidden) {
    return <div className="forbidden">你没有权限访问此内容</div>;
  }

  if (error) {
    return <div className="error">加载失败: {error.message}</div>;
  }

  if (empty) {
    return <div className="empty">暂无数据</div>;
  }

  return <>{children}</>;
}
```

- [ ] **Step 3: Update Admin Dashboard to use state components**

```typescript
// frontend/src/pages/team/admin/Dashboard.tsx
export function AdminDashboard() {
  const { teamId, teamName } = useCurrentTeam();
  
  const { data: skills = [], loading: skillsLoading, error: skillsError, forbidden: skillsForbidden } = useTeamSkills(teamId);
  const { data: reviews = [], loading: reviewsLoading, error: reviewsError } = useTeamReviews(teamId);
  const { data: members = [], loading: membersLoading } = useTeamMembers(teamId);
  const { data: activities = [], loading: activitiesLoading } = useTeamActivities(teamId);

  return (
    <div>
      <h1>{teamName} 工作台</h1>
      
      <DataState loading={skillsLoading} error={skillsError} forbidden={skillsForbidden} empty={skills.length === 0}>
        <SkillStats skills={skills} />
      </DataState>

      <DataState loading={reviewsLoading} error={reviewsError} empty={reviews.length === 0}>
        <ReviewQueue reviews={reviews} />
      </DataState>

      <DataState loading={membersLoading} empty={members.length === 0}>
        <MemberStats members={members} />
      </DataState>

      <DataState loading={activitiesLoading} empty={activities.length === 0}>
        <ActivityFeed activities={activities} />
      </DataState>
    </div>
  );
}
```

- [ ] **Step 4: Update Member Dashboard similarly**

```typescript
// frontend/src/pages/team/member/Dashboard.tsx
// Same pattern as AdminDashboard: wrap sections with DataState
```

- [ ] **Step 5: Test states**

```bash
cd frontend && npm run dev
# Admin Dashboard:
#   - Initially: see "加载中"
#   - After load: see data
#   - Try as non-member: see "你没有权限"
#   - If API fails: see error message
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/ \
        frontend/src/components/states/ \
        frontend/src/pages/team/admin/Dashboard.tsx \
        frontend/src/pages/team/member/Dashboard.tsx
git commit -m "feat: add loading/error/empty/forbidden states to data hooks and pages"
```

---

## Verification Checklist

Before declaring complete, verify against spec sections:

### ✅ 4.1 P0. Left Sidebar Navigation (Task 2)
- [ ] Click each sidebar menu item in Admin shell → navigates to correct route
- [ ] Click each sidebar menu item in Member shell → navigates to correct route
- [ ] Current active menu item highlights correctly

### ✅ 4.2 P0. Team Context (Task 1)
- [ ] Switch team via TopBar → dashboard data updates to new team
- [ ] Refresh page → team context persists
- [ ] Visit `/team` with no teams → shows NoTeamPage

### ✅ 4.3 P0. Role & Permissions (Task 3)
- [ ] Admin user sees Admin shell
- [ ] Member user sees Member shell
- [ ] Member accessing `/team/reviews` is rejected (403)
- [ ] Non-member accessing team data is rejected (403)

### ✅ 4.4 P1. Admin Dashboard (Task 5)
- [ ] No `CHART_DATA`, `WEEKLY_DELTAS` constants in code
- [ ] No hardcoded team names
- [ ] Stats show: public skills, private skills, pending reviews, members

### ✅ 4.5 P1. Member Dashboard (Task 6)
- [ ] "My Submissions" empty state when no submissions
- [ ] "My Submissions" never shows team submissions
- [ ] No "My Installed Skills" section

### ✅ 4.6 P1. Button Actions (Task 7)
- [ ] All visible buttons either navigate, call API, or are disabled
- [ ] No "can-click-but-does-nothing" buttons

### ✅ 4.7 P2. States (Task 8)
- [ ] Loading state shown during fetch
- [ ] Error message shown on API failure
- [ ] Forbidden message shown on 403
- [ ] Empty state shown when data is empty

---

## Smoke Test Command

```bash
./scripts/services.sh start
# Wait ~15 seconds for all services to be ready

# Frontend validation
cd frontend && npm run lint

# Backend validation  
cd backend && mvn test

# Manual testing
# 1. Open http://localhost:5173/team
# 2. Test sidebar navigation (Task 2)
# 3. Switch teams via TopBar (Task 1)
# 4. Try team selection as different roles (Task 3)
# 5. Verify dashboards show real data (Tasks 5-6)
# 6. Click buttons and verify they work or are disabled (Task 7)
# 7. Check loading/error states (Task 8)
```

---

## Task Parallelization Notes

**Can run in parallel:**
- Task 1 (Team Context) and Task 2 (Sidebar Navigation) are independent
- Task 4 (Backend Tests) can run alongside Task 3
- Task 5 (Admin Dashboard) and Task 6 (Member Dashboard) are independent once Task 1 is done

**Sequential dependencies:**
- Task 3 requires Task 1 (uses `useCurrentTeam()`)
- Task 7 requires Task 2 (uses sidebar routing)
- Tasks 5-8 require Task 1 (team context)

**Recommended execution order:**
1. Start Tasks 1 & 2 in parallel
2. Once Task 1 is done: start Tasks 3, 5, 6, 8 in parallel
3. Once Task 2 is done: start Task 7
4. Task 4 can start anytime

---

## Handoff Options

Plan complete and saved to `docs/superpowers/plans/2026-05-21-team-home-hardening.md`.

**Which execution approach?**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, I review between tasks, fast iteration with context switching between parallel workers

**2. Inline Execution** — Execute tasks sequentially in this session using `superpowers:executing-plans`, batch review with checkpoints
