# Join Screen Fixes & Navigation Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three bugs in the join screen (no auto-lookup on pre-fill, sparse UI, bad back navigation) and establish the global navigation architecture rule: all non-tab screens live at root level with no tab bar visible.

**Architecture:** Move `join.tsx`, `create.tsx`, and `[id].tsx` from `app/(tabs)/groups/` to `app/groups/` so they render in the root Stack above the tab bar. Update all navigation call sites and test imports/assertions. Add auto-lookup on pre-fill and two UI improvements to join screen.

**Tech Stack:** React Native, Expo Router v5 (file-based routing, root Stack), TypeScript, Jest + React Native Testing Library.

---

## Chunk 1: File moves and path updates (no behavior change)

### Task 1: Move group screens to root level and delete the nested layout

**Spec:** `docs/superpowers/specs/2026-03-16-join-screen-fixes-and-navigation-design.md` — "File moves" section.

**Context:** Expo Router maps files to routes by directory. Moving files from `app/(tabs)/groups/` to `app/groups/` makes them render in the root Stack (no tab bar). The root `_layout.tsx` already has `<Stack screenOptions={{ headerShown: false }}>` — all moved screens inherit it.

**Files:**

- Move: `app/(tabs)/groups/join.tsx` → `app/groups/join.tsx`
- Move: `app/(tabs)/groups/create.tsx` → `app/groups/create.tsx`
- Move: `app/(tabs)/groups/[id].tsx` → `app/groups/[id].tsx`
- Delete: `app/(tabs)/groups/_layout.tsx`

- [ ] **Step 1: Create `app/groups/` directory by copying the three files**

```bash
cd "C:\Users\Hernan\Documents\GitHub\PencaViva"
mkdir -p app/groups
cp "app/(tabs)/groups/join.tsx" app/groups/join.tsx
cp "app/(tabs)/groups/create.tsx" app/groups/create.tsx
cp "app/(tabs)/groups/[id].tsx" "app/groups/[id].tsx"
```

- [ ] **Step 2: Delete the originals and the layout**

```bash
cd "C:\Users\Hernan\Documents\GitHub\PencaViva"
rm "app/(tabs)/groups/join.tsx"
rm "app/(tabs)/groups/create.tsx"
rm "app/(tabs)/groups/[id].tsx"
rm "app/(tabs)/groups/_layout.tsx"
```

- [ ] **Step 3: Update nav calls inside `app/groups/join.tsx`**

In `app/groups/join.tsx` line 180, change:

```ts
router.replace(`/(tabs)/groups/${result.id}`);
```

to:

```ts
router.replace(`/groups/${result.id}`);
```

- [ ] **Step 4: Update nav call inside `app/groups/create.tsx`**

In `app/groups/create.tsx` line 160, change:

```ts
router.replace(`/(tabs)/groups/${created.id}`);
```

to:

```ts
router.replace(`/groups/${created.id}`);
```

- [ ] **Step 5: Update nav calls in `app/(tabs)/groups/index.tsx`**

Change lines 50, 57, 62 — three `router.push` calls:

```ts
// line 50 — handleGroupPress
router.push(`/(tabs)/groups/${groupId}`);
// → becomes:
router.push(`/groups/${groupId}`);

// line 57 — handleCreateGroup
router.push("/(tabs)/groups/create");
// → becomes:
router.push("/groups/create");

// line 62 — handleJoinGroup
router.push("/(tabs)/groups/join");
// → becomes:
router.push("/groups/join");
```

- [ ] **Step 6: Update `app/join/[code].tsx` — two path fixes**

Change line 32:

```ts
router.replace("/(tabs)/groups/join");
// → becomes:
router.replace("/groups/join");
```

Change line 41 — also change `replace` to `push`:

```ts
router.replace(`/(tabs)/groups/join?code=${code}`);
// → becomes:
router.push(`/groups/join?code=${code}`);
```

- [ ] **Step 7: Update `app/index.tsx` — pending invite path**

Change line 71:

```ts
router.replace(`/(tabs)/groups/join?code=${pendingInviteCode}`);
// → becomes:
router.replace(`/groups/join?code=${pendingInviteCode}`);
```

- [ ] **Step 8: Run typecheck and lint**

```bash
cd "C:\Users\Hernan\Documents\GitHub\PencaViva" && npm run typecheck && npm run lint
```

Expected: no errors. If there are import errors in the moved files, they will be from absolute `@lib/` / `@hooks/` paths which do NOT need updating — only the `router.push/replace` path strings change.

- [ ] **Step 9: Commit**

```bash
cd "C:\Users\Hernan\Documents\GitHub\PencaViva"
git add app/groups/ "app/(tabs)/groups/index.tsx" "app/join/[code].tsx" app/index.tsx
git rm "app/(tabs)/groups/join.tsx" "app/(tabs)/groups/create.tsx" "app/(tabs)/groups/[id].tsx" "app/(tabs)/groups/_layout.tsx"
git commit -m "refactor(navigation): move group screens to root Stack — no tab bar on join/create/detail"
```

---

### Task 2: Update test imports and path assertions

**Context:** Six test files reference old file paths or old route strings. No behavior changes yet — this task just keeps the test suite green after the file moves.

**Files:**

- Modify: `src/__tests__/navigation/join-group.test.tsx` (line 32 — import path, line 331 — path assertion)
- Modify: `src/__tests__/navigation/create-group.test.tsx` (line 25 — import path, line 81 — path assertion)
- Modify: `src/__tests__/navigation/group-screens.test.tsx` (lines 3–5 — three import paths)
- Modify: `src/__tests__/navigation/groups-screen.test.tsx` (lines 128, 141, 154, 190, 217 — five path assertions)
- Modify: `src/__tests__/navigation/deep-link.test.tsx` (lines 72, 90 — two path assertions)
- Modify: `src/__tests__/navigation/index-redirect.test.tsx` (line 163 — one path assertion)

- [ ] **Step 1: Update `src/__tests__/navigation/join-group.test.tsx`**

Change line 32 (import):

```ts
const JoinGroupScreen = require("../../../app/(tabs)/groups/join").default;
// → becomes:
const JoinGroupScreen = require("../../../app/groups/join").default;
```

Change line 331 (path assertion):

```ts
expect(mockReplace).toHaveBeenCalledWith("/(tabs)/groups/g-1");
// → becomes:
expect(mockReplace).toHaveBeenCalledWith("/groups/g-1");
```

- [ ] **Step 2: Update `src/__tests__/navigation/create-group.test.tsx`**

Change line 25 (import):

```ts
const CreateGroupScreen = require("../../../app/(tabs)/groups/create").default;
// → becomes:
const CreateGroupScreen = require("../../../app/groups/create").default;
```

Change line 81 (path assertion):

```ts
expect(mockReplace).toHaveBeenCalledWith("/(tabs)/groups/g-1");
// → becomes:
expect(mockReplace).toHaveBeenCalledWith("/groups/g-1");
```

- [ ] **Step 3: Update `src/__tests__/navigation/group-screens.test.tsx`**

Change lines 3–5 (three imports):

```ts
import GroupDetailScreen from "../../../app/(tabs)/groups/[id]";
import CreateGroupScreen from "../../../app/(tabs)/groups/create";
import JoinGroupScreen from "../../../app/(tabs)/groups/join";
// → becomes:
import GroupDetailScreen from "../../../app/groups/[id]";
import CreateGroupScreen from "../../../app/groups/create";
import JoinGroupScreen from "../../../app/groups/join";
```

- [ ] **Step 4: Update `src/__tests__/navigation/groups-screen.test.tsx`**

Change 5 path assertions (lines 128, 141, 154, 190, 217):

```ts
// line 128
expect(mockPush).toHaveBeenCalledWith("/(tabs)/groups/g1");
// → becomes:
expect(mockPush).toHaveBeenCalledWith("/groups/g1");

// line 141
expect(mockPush).toHaveBeenCalledWith("/(tabs)/groups/create");
// → becomes:
expect(mockPush).toHaveBeenCalledWith("/groups/create");

// line 154
expect(mockPush).toHaveBeenCalledWith("/(tabs)/groups/join");
// → becomes:
expect(mockPush).toHaveBeenCalledWith("/groups/join");

// line 190
expect(mockPush).toHaveBeenCalledWith("/(tabs)/groups/create");
// → becomes:
expect(mockPush).toHaveBeenCalledWith("/groups/create");

// line 217
expect(mockPush).toHaveBeenCalledWith("/(tabs)/groups/join");
// → becomes:
expect(mockPush).toHaveBeenCalledWith("/groups/join");
```

- [ ] **Step 5: Update `src/__tests__/navigation/deep-link.test.tsx`**

Change line 72 (invalid code path — now uses `/groups/join`):

```ts
expect(mockReplace).toHaveBeenCalledWith("/(tabs)/groups/join");
// → becomes:
expect(mockReplace).toHaveBeenCalledWith("/groups/join");
```

Change line 89–91 (auth'd path — now uses `mockPush` instead of `mockReplace`, new path):

```ts
expect(mockReplace).toHaveBeenCalledWith("/(tabs)/groups/join?code=ABC12345");
// → becomes:
expect(mockPush).toHaveBeenCalledWith("/groups/join?code=ABC12345");
```

**Note:** The deep-link test file currently only mocks `replace` on `mockReplace`. Since the auth'd path now uses `router.push`, you also need to add `mockPush` to the router mock in this test file. Read the top of `deep-link.test.tsx` to find the router mock and add `push: mockPush` alongside `replace: mockReplace`. Declare `const mockPush = jest.fn();` before the `jest.mock("expo-router", ...)` call, and reset it in `beforeEach`.

- [ ] **Step 6: Update `src/__tests__/navigation/index-redirect.test.tsx`**

Change line 163:

```ts
expect(mockRouter.replace).toHaveBeenCalledWith(
  "/(tabs)/groups/join?code=ABC12345",
);
// → becomes:
expect(mockRouter.replace).toHaveBeenCalledWith("/groups/join?code=ABC12345");
```

- [ ] **Step 7: Run all tests**

```bash
cd "C:\Users\Hernan\Documents\GitHub\PencaViva" && npm run test:ci 2>&1 | tail -10
```

Expected: all tests pass. If any fail, the error message will point to the exact line — fix and re-run.

- [ ] **Step 8: Commit**

```bash
cd "C:\Users\Hernan\Documents\GitHub\PencaViva"
git add src/__tests__/navigation/
git commit -m "test(navigation): update imports and path assertions after group screen moves"
```

---

## Chunk 2: Join screen behavior and UI improvements

### Task 3: Auto-lookup on pre-fill (Bug 1) + delete contradicting test

**Spec:** `docs/superpowers/specs/2026-03-16-join-screen-fixes-and-navigation-design.md` — "Bug 1" and join screen component details.

**Context:** `app/groups/join.tsx` has a `useEffect` that calls `updateDigits(codeParam.toUpperCase().split(""))` when a `code` URL param is present. It does NOT call `triggerLookup`. Adding `triggerLookup` after `updateDigits` in the same effect fixes the bug. `triggerLookup` is a `useCallback` — add it to the effect's dependency array.

**Files:**

- Modify: `app/groups/join.tsx` (pre-fill `useEffect`, line 68–71)
- Modify: `src/__tests__/navigation/join-group.test.tsx` (delete one test, add one test, update import path already done in Task 2)

- [ ] **Step 1: Write the new failing test (TDD — RED)**

Add a new test to `src/__tests__/navigation/join-group.test.tsx` after the existing "pre-fills digits from code param on mount" test:

```ts
it("auto-triggers lookup when pre-filling from code param", async () => {
  lookupGroupByInviteCode.mockResolvedValueOnce({
    id: "g-1",
    name: "Test Group",
    description: null,
    avatar_url: null,
    member_count: 5,
    max_members: 50,
    scoring_system: {
      exact_score: 5,
      correct_result: 3,
      correct_goal_diff: 1,
      wrong: 0,
    },
  });
  mockUseLocalSearchParams.mockReturnValue({ code: "ABC12345" });

  render(<JoinGroupScreen />);

  await waitFor(() => {
    expect(lookupGroupByInviteCode).toHaveBeenCalledWith("ABC12345");
  });
});
```

- [ ] **Step 2: Delete the contradicting test**

Delete the test at lines 395–402 titled `"does not auto-trigger lookup when pre-filling from code param"`. It asserts the opposite behavior and will fail after the fix.

The block to delete is:

```ts
it("does not auto-trigger lookup when pre-filling from code param", async () => {
  mockUseLocalSearchParams.mockReturnValue({ code: "ABC12345" });

  render(<JoinGroupScreen />);

  await new Promise((r) => setTimeout(r, 50));
  expect(lookupGroupByInviteCode).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run the new test to confirm it fails**

```bash
cd "C:\Users\Hernan\Documents\GitHub\PencaViva" && npm run test:unit -- --testPathPattern="join-group" 2>&1 | tail -20
```

Expected: FAIL — `lookupGroupByInviteCode` was not called.

- [ ] **Step 4: Fix `app/groups/join.tsx` — add `triggerLookup` to pre-fill effect**

The current pre-fill `useEffect` (around line 68):

```ts
useEffect(() => {
  if (!codeParam || !/^[0-9a-fA-F]{8}$/.test(codeParam)) return;
  updateDigits(codeParam.toUpperCase().split(""));
}, [codeParam, updateDigits]);
```

Change to:

```ts
useEffect(() => {
  if (!codeParam || !/^[0-9a-fA-F]{8}$/.test(codeParam)) return;
  updateDigits(codeParam.toUpperCase().split(""));
  triggerLookup(codeParam.toUpperCase());
}, [codeParam, updateDigits, triggerLookup]);
```

- [ ] **Step 5: Run tests to confirm GREEN**

```bash
cd "C:\Users\Hernan\Documents\GitHub\PencaViva" && npm run test:unit -- --testPathPattern="join-group" 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 6: Run full CI**

```bash
cd "C:\Users\Hernan\Documents\GitHub\PencaViva" && npm run lint && npm run typecheck && npm run test:ci 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
cd "C:\Users\Hernan\Documents\GitHub\PencaViva"
git add app/groups/join.tsx src/__tests__/navigation/join-group.test.tsx
git commit -m "fix(join): auto-trigger lookup when code pre-filled from URL param"
```

---

### Task 4: Join screen UI improvements (Bug 2)

**Spec:** `docs/superpowers/specs/2026-03-16-join-screen-fixes-and-navigation-design.md` — "Bug 2" and join screen component details.

**Context:** Add three UI elements to `app/groups/join.tsx`:

1. **Subtitle** — below header, above "INVITE CODE" label
2. **Error empty state** — icon + helper text when `state === "error"`, rendered below the existing error message text
3. **Paste tip** — small text at bottom, shown only when `state === "idle"`

No changes to logic — purely additive JSX.

**Files:**

- Modify: `app/groups/join.tsx`
- Modify: `src/__tests__/navigation/join-group.test.tsx` (add 3 tests)

- [ ] **Step 1: Write failing tests (TDD — RED)**

Add these three tests to `src/__tests__/navigation/join-group.test.tsx`:

```ts
it("shows subtitle text", () => {
  const { getByText } = render(<JoinGroupScreen />);
  expect(
    getByText("Enter the 8-character code shared by your group"),
  ).toBeTruthy();
});

it("shows error empty state with helper text when group not found", async () => {
  lookupGroupByInviteCode.mockRejectedValueOnce(new Error("group_not_found"));

  const { getAllByTestId, getByTestId, getByText } = render(<JoinGroupScreen />);
  const inputs = getAllByTestId(/^code-input-/);

  await act(async () => {
    const code = "AB12CD34";
    for (let i = 0; i < 8; i++) {
      fireEvent.changeText(inputs[i], code[i]);
    }
  });

  await waitFor(() => {
    expect(getByTestId("error-message")).toBeTruthy();
  });
  expect(getByTestId("error-empty-state")).toBeTruthy();
  expect(getByText("Ask your admin for the correct invite code")).toBeTruthy();
});

it("shows paste tip in idle state", () => {
  const { getByText } = render(<JoinGroupScreen />);
  expect(getByText("Tip: you can paste the full code at once")).toBeTruthy();
});
```

- [ ] **Step 2: Run to confirm RED**

```bash
cd "C:\Users\Hernan\Documents\GitHub\PencaViva" && npm run test:unit -- --testPathPattern="join-group" 2>&1 | tail -20
```

Expected: 3 new tests fail.

- [ ] **Step 3: Add subtitle to `app/groups/join.tsx`**

In the JSX, after the closing `</View>` of the header row (after line 218) and before `{/* Code Input */}`, add:

```tsx
{
  /* Subtitle */
}
<Text
  style={{
    color: colors.textSecondary,
    fontSize: 13,
    paddingHorizontal: 24,
    marginBottom: 4,
  }}
>
  Enter the 8-character code shared by your group
</Text>;
```

- [ ] **Step 4: Add error empty state to `app/groups/join.tsx`**

After the existing `{state === "error" && errorText ? ... : null}` block, **before** the closing `</View>` that ends the `{/* Code Input */}` section (the `</View>` on line 286 of the original file), add:

```tsx
{
  /* Error empty state */
}
{
  state === "error" ? (
    <View
      testID="error-empty-state"
      style={{ alignItems: "center", marginTop: 24, paddingHorizontal: 24 }}
    >
      <Text style={{ fontSize: 28, marginBottom: 8 }}>🔍</Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 13,
          textAlign: "center",
        }}
      >
        Ask your admin for the correct invite code
      </Text>
    </View>
  ) : null;
}
```

- [ ] **Step 5: Add paste tip to `app/groups/join.tsx`**

After the closing `</View>` of `{/* Code Input */}` section (after line 286), and before `{/* Loading spinner */}`, add:

```tsx
{
  /* Paste tip */
}
{
  state === "idle" ? (
    <Text
      style={{
        color: colors.textSecondary,
        fontSize: 11,
        textAlign: "center",
        marginTop: 12,
        opacity: 0.6,
      }}
    >
      Tip: you can paste the full code at once
    </Text>
  ) : null;
}
```

- [ ] **Step 6: Run tests to confirm GREEN**

```bash
cd "C:\Users\Hernan\Documents\GitHub\PencaViva" && npm run test:unit -- --testPathPattern="join-group" 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 7: Run full CI**

```bash
cd "C:\Users\Hernan\Documents\GitHub\PencaViva" && npm run lint && npm run typecheck && npm run test:ci 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
cd "C:\Users\Hernan\Documents\GitHub\PencaViva"
git add app/groups/join.tsx src/__tests__/navigation/join-group.test.tsx
git commit -m "feat(join): add subtitle, error empty state, and paste tip"
```

---

## Chunk 3: Final checks and docs

### Task 5: CI checks and TAREAS.md update

**Files:**

- Modify: `TAREAS.md` (mark task complete)

- [ ] **Step 1: Run full CI one final time**

```bash
cd "C:\Users\Hernan\Documents\GitHub\PencaViva" && npm run format:check && npm run lint && npm run typecheck && npm run test:ci 2>&1 | tail -15
```

If `format:check` fails, run `npm run format` then re-run.

Expected: all green.

- [ ] **Step 2: Update `TAREAS.md`**

F1-13 is already marked `[x]`. Add a new entry for this bug fix work after the F1-13 line:

```markdown
- [x] **F1-13b** Join screen bug fixes + navigation architecture
  - Auto-lookup on deep link pre-fill, join screen UI improvements, global nav rule (non-tab screens at root Stack)
  - Depends: F1-13
  - Notes: All non-tab screens now live in app/<feature>/ at root level, not inside app/(tabs)/
```

- [ ] **Step 3: Update `CLAUDE.md`**

Add the navigation architecture rule to the Architecture Decisions section in `CLAUDE.md`. Find the "## Architecture Decisions" section and add this bullet:

```markdown
- **Navigation pattern**: The 5-tab bar is the app's home base. Tab root screens live in `app/(tabs)/<name>.tsx` (tab bar visible). All other screens (detail, action, form) live at root level in `app/<feature>/<name>.tsx` (no tab bar, back arrow returns to previous screen). Example: `app/groups/join.tsx`, `app/groups/create.tsx`, `app/groups/[id].tsx`, `app/match/[id].tsx`. This rule applies to all tabs and all future features.
```

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\Hernan\Documents\GitHub\PencaViva"
git add TAREAS.md CLAUDE.md
git commit -m "docs: add navigation architecture rule to CLAUDE.md, mark F1-13b complete"
```

- [ ] **Step 4: Push**

```bash
cd "C:\Users\Hernan\Documents\GitHub\PencaViva" && git push origin develop
```
