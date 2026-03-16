# F1-13: Deep Link for Invitations — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable `pencaviva://join/<code>` deep links to open the join screen with the invite code pre-filled, persisting the code through auth/onboarding for unauthenticated users.

**Architecture:** A new `app/join/[code].tsx` landing route handles the deep link — it either redirects an authenticated+complete user directly to the join screen with the code as a query param, or saves the code to SecureStore and redirects to `/` (letting `app/index.tsx` route through auth). After profile completion resolves, `app/index.tsx` checks for a pending invite code and redirects to the join screen instead of tabs. The join screen pre-fills its 8 digit boxes from the `code` query param on mount.

**Tech Stack:** Expo Router v5 (custom scheme `pencaviva://`), Zustand auth store, expo-secure-store via `src/lib/storage.ts`, React Native Testing Library, Jest

**Spec:** `docs/superpowers/specs/2026-03-16-f1-13-deep-link-invitations-design.md`

---

## Chunk 1: Storage helper + pending-invite module

### Task 1: Add `deleteStorageItem` to `src/lib/storage.ts`

**Files:**

- Modify: `src/lib/storage.ts`
- Modify: `src/lib/storage.ts` (tests are inline — no separate test file for storage helpers exists; test via pending-invite tests in Task 2)

**Background:** `src/lib/storage.ts` wraps `expo-secure-store` with a `Platform.OS === "web"` branch for both `getStorageItem` and `setStorageItem`. We need the same pattern for delete. The existing file:

```ts
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export async function getStorageItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

export async function setStorageItem(
  key: string,
  value: string,
): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}
```

- [ ] **Step 1: Add `deleteStorageItem` to `src/lib/storage.ts`**

Append to the end of the file:

```ts
export async function deleteStorageItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

---

### Task 2: Create `src/lib/pending-invite.ts` with tests (TDD)

**Files:**

- Create: `src/lib/pending-invite.ts`
- Create: `src/__tests__/lib/pending-invite.test.ts`

**Background:** This is a thin wrapper over the storage helpers. The SecureStore mock in Jest (`src/__mocks__/expo-secure-store.ts`) maintains an in-memory store and exposes a `__resetStore()` method — use it in `beforeEach`. Storage key is `"pending_invite_code"`.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/lib/pending-invite.test.ts`:

```ts
import * as SecureStore from "expo-secure-store";
import {
  savePendingInviteCode,
  getPendingInviteCode,
  clearPendingInviteCode,
} from "@lib/pending-invite";

beforeEach(() => {
  (SecureStore as unknown as { __resetStore: () => void }).__resetStore();
});

describe("pending-invite", () => {
  it("getPendingInviteCode returns null when nothing stored", async () => {
    expect(await getPendingInviteCode()).toBeNull();
  });

  it("savePendingInviteCode stores the code", async () => {
    await savePendingInviteCode("ABCD1234");
    expect(await getPendingInviteCode()).toBe("ABCD1234");
  });

  it("clearPendingInviteCode removes the stored code", async () => {
    await savePendingInviteCode("ABCD1234");
    await clearPendingInviteCode();
    expect(await getPendingInviteCode()).toBeNull();
  });

  it("savePendingInviteCode overwrites an existing code", async () => {
    await savePendingInviteCode("ABCD1234");
    await savePendingInviteCode("FFFF0000");
    expect(await getPendingInviteCode()).toBe("FFFF0000");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:unit -- --testPathPattern="pending-invite"
```

Expected: FAIL — `Cannot find module '@lib/pending-invite'`

- [ ] **Step 3: Create `src/lib/pending-invite.ts`**

```ts
import { getStorageItem, setStorageItem, deleteStorageItem } from "./storage";

const PENDING_INVITE_KEY = "pending_invite_code";

export async function savePendingInviteCode(code: string): Promise<void> {
  await setStorageItem(PENDING_INVITE_KEY, code);
}

export async function getPendingInviteCode(): Promise<string | null> {
  return getStorageItem(PENDING_INVITE_KEY);
}

export async function clearPendingInviteCode(): Promise<void> {
  await deleteStorageItem(PENDING_INVITE_KEY);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:unit -- --testPathPattern="pending-invite"
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/pending-invite.ts src/__tests__/lib/pending-invite.test.ts
git commit -m "feat(deep-link): add deleteStorageItem + pending-invite module"
```

---

## Chunk 2: Update `useLocalSearchParams` mock

### Task 3: Convert `useLocalSearchParams` to `jest.fn()` in expo-router mock

**Files:**

- Modify: `src/__mocks__/expo-router.tsx`

**Background:** The current mock returns `{}` from a plain function. Changing it to `jest.fn()` lets individual test files call `(useLocalSearchParams as jest.Mock).mockReturnValue({ code: 'ABC12345' })`. No existing tests rely on overriding this mock's return value, so the change is safe.

- [ ] **Step 1: Update the mock**

In `src/__mocks__/expo-router.tsx`, replace:

```ts
function useLocalSearchParams() {
  return {};
}
```

with:

```ts
const useLocalSearchParams = jest.fn(
  () => ({}) as Record<string, string | string[]>,
);
```

- [ ] **Step 2: Run all unit tests to verify no regressions**

```bash
npm run test:unit
```

Expected: All existing tests still PASS (the default return value `{}` is unchanged).

- [ ] **Step 3: Commit**

```bash
git add src/__mocks__/expo-router.tsx
git commit -m "test: convert useLocalSearchParams mock to jest.fn()"
```

---

## Chunk 3: Deep link landing route

### Task 4: Create `app/join/[code].tsx` with tests (TDD)

**Files:**

- Create: `app/join/[code].tsx`
- Create: `src/__tests__/navigation/deep-link.test.tsx`

**Background:** Expo Router maps `pencaviva://join/ABC12345` to `app/join/[code].tsx` automatically via `scheme: "pencaviva"` in `app.config.ts`. No config changes needed.

The component needs to:

1. Read the `code` param from `useLocalSearchParams`
2. Validate it: `/^[0-9a-fA-F]{8}$/`
3. Read both `isInitialized` (from `useAuthStore`) and `hasCompletedOnboarding` (from SecureStore) before deciding
4. Render a loading spinner while either is still loading
5. Once ready, execute the decision tree (see spec)

The `useAuthStore` in tests is mocked the same way as in `index-redirect.test.tsx`. The `useLocalSearchParams` mock is now a `jest.fn()` — override per test.

**Important:** The component needs to check profile completeness for the "auth'd + profile complete" branch. Rather than calling `checkProfileComplete` (an async call that adds loading complexity), read `user` from the auth store — if `user` exists and the session is valid, trust `app/index.tsx`'s profile check. The deep link route does NOT do a profile check — it only distinguishes "authenticated" vs "not authenticated". The "auth'd + profile incomplete" case is handled by `app/index.tsx` finding the pending code after profile completion.

Wait — re-reading the spec: the "auth'd + profile complete" branch sends the user directly to the join screen, while "auth'd + profile incomplete" saves the code and defers. The deep link route therefore DOES need to check profile completeness. Implement it by calling `checkProfileComplete(user.id)` with the same pattern as `app/index.tsx`.

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/navigation/deep-link.test.tsx`:

```tsx
import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "@stores/auth-store";
import { useLocalSearchParams } from "expo-router";

jest.mock("@lib/supabase");
jest.mock("@lib/google-auth");
jest.mock("@stores/auth-store");
jest.mock("@lib/pending-invite", () => ({
  savePendingInviteCode: jest.fn(),
  clearPendingInviteCode: jest.fn(),
}));

const mockCheckProfileComplete = jest.fn();
jest.mock("@lib/profile-service", () => ({
  checkProfileComplete: (...args: unknown[]) =>
    mockCheckProfileComplete(...args),
}));

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: jest.fn(() => ({}) as Record<string, string>),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { savePendingInviteCode } = require("@lib/pending-invite");
const DeepLinkScreen = require("../../../app/join/[code]").default;
/* eslint-enable @typescript-eslint/no-require-imports */

function setupAuthStore(
  overrides: Partial<{
    isInitialized: boolean;
    session: unknown;
    user: unknown;
  }> = {},
) {
  const state = {
    isInitialized: true,
    session: null,
    user: null,
    ...overrides,
  };
  (useAuthStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state),
  );
}

beforeEach(() => {
  (SecureStore as unknown as { __resetStore: () => void }).__resetStore();
  jest.clearAllMocks();
  setupAuthStore();
  mockCheckProfileComplete.mockResolvedValue(true);
  // Default: valid code param
  (useLocalSearchParams as jest.Mock).mockReturnValue({ code: "ABCD1234" });
});

describe("DeepLinkScreen", () => {
  it("shows loading spinner before ready", () => {
    setupAuthStore({ isInitialized: false });
    const { getByTestId } = render(<DeepLinkScreen />);
    expect(getByTestId("loading-indicator")).toBeTruthy();
  });

  it("hot path: redirects auth'd+complete user to join screen with code", async () => {
    SecureStore.setItem("onboarding_completed", "true");
    setupAuthStore({
      isInitialized: true,
      session: { access_token: "t", user: { id: "u1" } },
      user: { id: "u1" },
    });
    mockCheckProfileComplete.mockResolvedValue(true);

    render(<DeepLinkScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/(tabs)/groups/join?code=ABCD1234",
      );
    });
    expect(savePendingInviteCode).not.toHaveBeenCalled();
  });

  it("deferred path: saves code and redirects to / for unauthenticated user", async () => {
    SecureStore.setItem("onboarding_completed", "true");
    setupAuthStore({ isInitialized: true, session: null, user: null });

    render(<DeepLinkScreen />);

    await waitFor(() => {
      expect(savePendingInviteCode).toHaveBeenCalledWith("ABCD1234");
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });

  it("deferred path: saves code and redirects to / for auth'd+incomplete user", async () => {
    SecureStore.setItem("onboarding_completed", "true");
    setupAuthStore({
      isInitialized: true,
      session: { access_token: "t", user: { id: "u1" } },
      user: { id: "u1" },
    });
    mockCheckProfileComplete.mockResolvedValue(false);

    render(<DeepLinkScreen />);

    await waitFor(() => {
      expect(savePendingInviteCode).toHaveBeenCalledWith("ABCD1234");
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });

  it("invalid code: redirects to empty join screen", async () => {
    SecureStore.setItem("onboarding_completed", "true");
    setupAuthStore({ isInitialized: true, session: null, user: null });
    (useLocalSearchParams as jest.Mock).mockReturnValue({ code: "BADCODE!" });

    render(<DeepLinkScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)/groups/join");
    });
    expect(savePendingInviteCode).not.toHaveBeenCalled();
  });

  it("invalid code: too short redirects to empty join screen", async () => {
    SecureStore.setItem("onboarding_completed", "true");
    setupAuthStore({ isInitialized: true, session: null, user: null });
    (useLocalSearchParams as jest.Mock).mockReturnValue({ code: "ABC" });

    render(<DeepLinkScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)/groups/join");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:unit -- --testPathPattern="deep-link"
```

Expected: FAIL — `Cannot find module '../../../app/join/[code]'`

- [ ] **Step 3: Create `app/join/[code].tsx`**

```tsx
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "@stores/auth-store";
import { checkProfileComplete } from "@lib/profile-service";
import { savePendingInviteCode } from "@lib/pending-invite";
import { colors } from "@lib/constants";

const VALID_CODE_RE = /^[0-9a-fA-F]{8}$/;

export default function DeepLinkJoinScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);

  const [isReady, setIsReady] = useState(false);

  // Wait for auth initialization
  useEffect(() => {
    if (!isInitialized) return;
    setIsReady(true);
  }, [isInitialized]);

  useEffect(() => {
    if (!isReady) return;

    const validCode =
      typeof code === "string" && VALID_CODE_RE.test(code) ? code : null;

    if (!validCode) {
      router.replace("/(tabs)/groups/join");
      return;
    }

    if (!session || !user) {
      // Not authenticated — save and defer
      savePendingInviteCode(validCode).then(() => {
        router.replace("/");
      });
      return;
    }

    // Authenticated — check profile completeness
    checkProfileComplete(user.id)
      .then((complete) => {
        if (complete) {
          router.replace(`/(tabs)/groups/join?code=${validCode}`);
        } else {
          savePendingInviteCode(validCode).then(() => {
            router.replace("/");
          });
        }
      })
      .catch(() => {
        // Fail-open: treat as complete
        router.replace(`/(tabs)/groups/join?code=${validCode}`);
      });
  }, [isReady, code, session, user, router]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator
        testID="loading-indicator"
        color={colors.primary}
        size="large"
      />
    </View>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:unit -- --testPathPattern="deep-link"
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Run full unit tests for regressions**

```bash
npm run test:unit
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add app/join/[code].tsx src/__tests__/navigation/deep-link.test.tsx
git commit -m "feat(deep-link): add app/join/[code].tsx landing route"
```

---

## Chunk 4: Update `app/index.tsx` for pending invite

### Task 5: Add pending invite check to `app/index.tsx` (TDD)

**Files:**

- Modify: `app/index.tsx`
- Modify: `src/__tests__/navigation/index-redirect.test.tsx`

**Background:** The current `app/index.tsx` uses four state flags (`isReady`, `hasCompletedOnboarding`, `isProfileChecked`, `isProfileComplete`) and renders `<Redirect>` components. The happy path currently returns `<Redirect href="/(tabs)" />`.

We need to:

1. Add a `pendingInviteCode: string | null` state (init `null`)
2. In the profile-completion `useEffect`, after `checkProfileComplete` resolves with `true`, also `await getPendingInviteCode()` before calling the state setters — all three setters called synchronously (React 18 batches them)
3. Replace the `<Redirect href="/(tabs)" />` JSX branch with `null` and add a new `useEffect` that fires the final `router.replace(...)` once `isProfileChecked && isProfileComplete`

The existing tests check for `screen.getByText("Redirect to /(tabs)")` — this will break once we remove that `<Redirect>`. We need to update those tests to check for `mockReplace` calls instead. However, the existing test file uses `render(<Index />)` with no router mock — the `mockRouter` from `expo-router` mock provides `replace`. We need to import and use it.

**Note on test structure:** The existing tests use the shared expo-router mock's `mockRouter.replace`. Import it to assert on it. Add `import { useRouter } from "expo-router"` and access `useRouter().replace` — but since the mock returns the singleton `mockRouter`, just check `mockRouter.replace` directly by requiring it.

- [ ] **Step 1: Add new test cases to `index-redirect.test.tsx`**

Add to the existing `describe("App Index")` block:

```ts
// At top of file, add import for useRouter:
// import { useRouter } from "expo-router";
// And add:
// const { mockRouter } = require("expo-router") — NOT how to access it.
// Instead: the mock exports useRouter which returns mockRouter.
// Access via: import { useRouter } from "expo-router"; const router = useRouter();
// But since we're outside a component, use jest.fn directly.
// The cleanest approach: add mockPendingInviteCode to the test setup.
```

**Simpler approach:** mock `@lib/pending-invite` in the test file and check `mockReplace` from the router mock.

Add at the top of `index-redirect.test.tsx` (after existing mocks):

```ts
const mockGetPendingInviteCode = jest.fn();
const mockClearPendingInviteCode = jest.fn();
jest.mock("@lib/pending-invite", () => ({
  getPendingInviteCode: (...args: unknown[]) =>
    mockGetPendingInviteCode(...args),
  clearPendingInviteCode: (...args: unknown[]) =>
    mockClearPendingInviteCode(...args),
}));
```

Also add to the router mock — the existing file doesn't mock `useRouter` explicitly, it uses the shared mock. Add to `beforeEach`:

```ts
mockGetPendingInviteCode.mockResolvedValue(null);
mockClearPendingInviteCode.mockResolvedValue(undefined);
```

Now add these new test cases:

```ts
it("redirects to join screen when pending invite code exists after profile completion", async () => {
  SecureStore.setItem("onboarding_completed", "true");
  setupAuthStore({
    isInitialized: true,
    session: { access_token: "test", user: { id: "123" } },
    user: { id: "123" },
  });
  mockCheckProfileComplete.mockResolvedValue(true);
  mockGetPendingInviteCode.mockResolvedValue("ABCD1234");

  render(<Index />);

  await waitFor(() => {
    // The <Redirect href="/(tabs)" /> is gone — replaced by router.replace
    expect(mockClearPendingInviteCode).toHaveBeenCalled();
  });
  // router.replace should be called with the join URL
  // Access via the shared mock's mockRouter
  const { useRouter } = require("expo-router");
  const router = useRouter();
  await waitFor(() => {
    expect(router.replace).toHaveBeenCalledWith(
      "/(tabs)/groups/join?code=ABCD1234",
    );
  });
});

it("redirects to tabs when no pending invite code", async () => {
  SecureStore.setItem("onboarding_completed", "true");
  setupAuthStore({
    isInitialized: true,
    session: { access_token: "test", user: { id: "123" } },
    user: { id: "123" },
  });
  mockCheckProfileComplete.mockResolvedValue(true);
  mockGetPendingInviteCode.mockResolvedValue(null);

  render(<Index />);

  const { useRouter } = require("expo-router");
  const router = useRouter();
  await waitFor(() => {
    expect(router.replace).toHaveBeenCalledWith("/(tabs)");
  });
});
```

**Also update the existing "redirects to tabs when onboarding completed and authenticated with complete profile" test** — it currently checks `screen.getByText("Redirect to /(tabs)")` which will no longer work. Change it to:

```ts
it("redirects to tabs when onboarding completed and authenticated with complete profile", async () => {
  SecureStore.setItem("onboarding_completed", "true");
  setupAuthStore({
    isInitialized: true,
    session: { access_token: "test", user: { id: "123" } },
    user: { id: "123" },
  });
  mockCheckProfileComplete.mockResolvedValue(true);
  mockGetPendingInviteCode.mockResolvedValue(null);

  render(<Index />);

  const { useRouter } = require("expo-router");
  const router = useRouter();
  await waitFor(() => {
    expect(router.replace).toHaveBeenCalledWith("/(tabs)");
  });
});
```

And **update the "fails open to tabs when profile check throws" test** similarly:

```ts
it("fails open to tabs when profile check throws", async () => {
  SecureStore.setItem("onboarding_completed", "true");
  setupAuthStore({
    isInitialized: true,
    session: { access_token: "test", user: { id: "123" } },
    user: { id: "123" },
  });
  mockCheckProfileComplete.mockRejectedValue(new Error("Network error"));

  render(<Index />);

  const { useRouter } = require("expo-router");
  const router = useRouter();
  await waitFor(() => {
    expect(router.replace).toHaveBeenCalledWith("/(tabs)");
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail and the updated ones may fail**

```bash
npm run test:unit -- --testPathPattern="index-redirect"
```

Expected: some FAIL (new tests + updated tests referencing `router.replace`).

- [ ] **Step 3: Update `app/index.tsx`**

Replace the full file content:

```tsx
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { getStorageItem } from "@lib/storage";
import { ONBOARDING_STORAGE_KEY } from "@lib/onboarding";
import { useAuthStore } from "@stores/auth-store";
import { checkProfileComplete } from "@lib/profile-service";
import {
  getPendingInviteCode,
  clearPendingInviteCode,
} from "@lib/pending-invite";

export default function Index() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isProfileChecked, setIsProfileChecked] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(
    null,
  );
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    getStorageItem(ONBOARDING_STORAGE_KEY).then((value) => {
      setHasCompletedOnboarding(value === "true");
      setIsReady(true);
    });
  }, []);

  // Profile completion check (only when authenticated)
  useEffect(() => {
    if (!user?.id) {
      setIsProfileChecked(false);
      setIsProfileComplete(false);
      setPendingInviteCode(null);
      return;
    }

    let cancelled = false;

    checkProfileComplete(user.id)
      .then(async (complete) => {
        if (cancelled) return;
        const localCode = complete ? await getPendingInviteCode() : null;
        if (cancelled) return;
        // All three setters called synchronously — React 18 batches into one render
        setPendingInviteCode(localCode);
        setIsProfileComplete(complete);
        setIsProfileChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setPendingInviteCode(null);
        setIsProfileComplete(true);
        setIsProfileChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Final redirect for the happy path (profile complete)
  useEffect(() => {
    if (!isProfileChecked || !isProfileComplete) return;
    if (pendingInviteCode) {
      clearPendingInviteCode().then(() => {
        router.replace(`/(tabs)/groups/join?code=${pendingInviteCode}`);
      });
    } else {
      router.replace("/(tabs)");
    }
  }, [isProfileChecked, isProfileComplete, pendingInviteCode, router]);

  // Wait for onboarding check and auth initialization
  if (!isReady || !isInitialized) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0D0D0D",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator testID="loading-indicator" color="#00D4AA" />
      </View>
    );
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  // Wait for profile completion check
  if (!isProfileChecked) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0D0D0D",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator testID="loading-indicator" color="#00D4AA" />
      </View>
    );
  }

  if (!isProfileComplete) {
    return <Redirect href="/(auth)/complete-profile" />;
  }

  // Happy path: final redirect handled by useEffect above
  return null;
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:unit -- --testPathPattern="index-redirect"
```

Expected: PASS — all tests including new ones.

- [ ] **Step 5: Run full unit tests for regressions**

```bash
npm run test:unit
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add app/index.tsx src/__tests__/navigation/index-redirect.test.tsx
git commit -m "feat(deep-link): add pending invite check to app/index.tsx"
```

---

## Chunk 5: Fix `complete-profile.tsx` navigation + join screen pre-fill

### Task 6: Change `complete-profile.tsx` navigation target

**Files:**

- Modify: `app/(auth)/complete-profile.tsx` (line ~160)
- Modify: `src/__tests__/navigation/auth-screens.test.tsx` (if it asserts on the `/(tabs)` navigation)

**Background:** Currently `complete-profile.tsx` calls `router.replace("/(tabs)")` on successful save. This bypasses `app/index.tsx`, so a pending invite code would be stranded. Change to `router.replace("/")` so index re-runs and picks up the pending code.

**Note:** No existing test in `auth-screens.test.tsx` currently asserts the navigation target after profile save. We add a new test first (RED), then implement.

- [ ] **Step 1: Add a failing test to `auth-screens.test.tsx`**

Find the mock for `useRouter` in `auth-screens.test.tsx` — it already has a `mockReplace = jest.fn()` (or equivalent). Add this test to the `describe("CompleteProfileScreen")` block, after the existing tests:

```ts
it("navigates to / after successfully saving profile", async () => {
  // Fill in a valid username so the save button is enabled
  // (look at the existing test setup in auth-screens.test.tsx
  //  to match how they trigger a successful save)
  // The key assertion:
  await waitFor(() => {
    expect(mockReplace).toHaveBeenCalledWith("/");
  });
});
```

**Important:** Read `auth-screens.test.tsx` before writing this test to understand how existing tests trigger the save flow (username input, debounce mock, save button press). Match that pattern exactly. The assertion is `expect(mockReplace).toHaveBeenCalledWith("/")`.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- --testPathPattern="auth-screens"
```

Expected: FAIL — `mockReplace` is called with `"/(tabs)"` not `"/"`

- [ ] **Step 3: Update `complete-profile.tsx`**

In `app/(auth)/complete-profile.tsx`, find and change:

```ts
// Before (around line 160):
router.replace("/(tabs)");

// After:
router.replace("/");
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:unit -- --testPathPattern="auth-screens"
```

Expected: PASS — all tests including new one.

- [ ] **Step 5: Run full unit tests for regressions**

```bash
npm run test:unit
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add app/(auth)/complete-profile.tsx src/__tests__/navigation/auth-screens.test.tsx
git commit -m "fix(deep-link): navigate to / after profile completion so pending invite is processed"
```

---

### Task 7: Pre-fill join screen from `code` param (TDD)

**Files:**

- Modify: `app/(tabs)/groups/join.tsx`
- Modify: `src/__tests__/navigation/join-group.test.tsx`

**Background:** The join screen needs to read a `code` query param on mount and pre-fill the 8 digit boxes. The existing `updateDigits(arr)` helper sets both `digits` state and `digitsRef.current` — call it with `code.toUpperCase().split('')`. Pre-filling does NOT trigger `handleChangeText`, so no auto-lookup fires — the user sees filled boxes and taps "Join Group" to start the lookup.

The join-group test file uses its own inline expo-router mock (`jest.mock("expo-router", ...)`), so the shared mock's `useLocalSearchParams` change doesn't affect it. We need to include `useLocalSearchParams` in the inline mock.

- [ ] **Step 1: Add pre-fill test to `join-group.test.tsx`**

In `src/__tests__/navigation/join-group.test.tsx`, the inline `jest.mock("expo-router", ...)` doesn't currently include `useLocalSearchParams`. Update the mock:

```ts
// Replace the existing expo-router mock:
jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
    back: mockBack,
  }),
  useLocalSearchParams: jest.fn(() => ({})),
}));
```

Then add this test case to the `describe("JoinGroupScreen")` block:

```ts
it("pre-fills digit boxes when code query param is provided", async () => {
  const { useLocalSearchParams } = require("expo-router");
  (useLocalSearchParams as jest.Mock).mockReturnValue({ code: "ABCD1234" });

  const { getAllByTestId } = render(<JoinGroupScreen />);
  const inputs = getAllByTestId(/^code-input-/);

  await waitFor(() => {
    // Each box should show the corresponding character
    expect(inputs[0].props.value).toBe("A");
    expect(inputs[1].props.value).toBe("B");
    expect(inputs[2].props.value).toBe("C");
    expect(inputs[3].props.value).toBe("D");
    expect(inputs[4].props.value).toBe("1");
    expect(inputs[5].props.value).toBe("2");
    expect(inputs[6].props.value).toBe("3");
    expect(inputs[7].props.value).toBe("4");
  });
});

it("does not auto-trigger lookup when pre-filled from code param", async () => {
  const { useLocalSearchParams } = require("expo-router");
  (useLocalSearchParams as jest.Mock).mockReturnValue({ code: "ABCD1234" });

  render(<JoinGroupScreen />);

  await waitFor(() => {
    // lookupGroupByInviteCode should NOT have been called automatically
    expect(lookupGroupByInviteCode).not.toHaveBeenCalled();
  });
});

it("does not pre-fill when code param is absent", () => {
  const { useLocalSearchParams } = require("expo-router");
  (useLocalSearchParams as jest.Mock).mockReturnValue({});

  const { getAllByTestId } = render(<JoinGroupScreen />);
  const inputs = getAllByTestId(/^code-input-/);
  inputs.forEach((input) => {
    expect(input.props.value).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

```bash
npm run test:unit -- --testPathPattern="join-group"
```

Expected: new pre-fill tests FAIL, existing tests PASS.

- [ ] **Step 3: Update `app/(tabs)/groups/join.tsx`**

Three changes:

**a) Add `useEffect` to the React import** (line 1 — currently `useState, useRef, useCallback` only):

```ts
// Before:
import { useState, useRef, useCallback } from "react";
// After:
import { useState, useRef, useCallback, useEffect } from "react";
```

**b) Add `useLocalSearchParams` to the expo-router import:**

```ts
// Before:
import { useRouter } from "expo-router";
// After:
import { useRouter, useLocalSearchParams } from "expo-router";
```

**c) Inside the component**, add after `const router = useRouter();`:

```ts
const { code: codeParam } = useLocalSearchParams<{ code?: string }>();
```

Then add the pre-fill effect after the existing state declarations. `updateDigits` is defined with `useCallback` and an empty dep array — it's stable, safe to include in deps:

```ts
// Pre-fill from deep link code param (display-only, no auto-lookup)
useEffect(() => {
  if (!codeParam) return;
  const VALID_CODE_RE = /^[0-9a-fA-F]{8}$/;
  if (!VALID_CODE_RE.test(codeParam)) return;
  updateDigits(codeParam.toUpperCase().split(""));
}, [codeParam, updateDigits]);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:unit -- --testPathPattern="join-group"
```

Expected: PASS — all tests including 3 new pre-fill tests.

- [ ] **Step 5: Run full unit test suite**

```bash
npm run test:unit
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/groups/join.tsx src/__tests__/navigation/join-group.test.tsx
git commit -m "feat(deep-link): pre-fill join screen from code query param"
```

---

## Chunk 6: CI checks + final validation

### Task 8: Run full CI checks and finalize

**Files:** No changes — validation only.

- [ ] **Step 1: Run format check**

```bash
npm run format:check
```

If any files fail: `npm run format` then re-run. Expected: clean.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Run all unit tests with coverage**

```bash
npm run test:ci
```

Expected: all pass.

- [ ] **Step 5: Update `TAREAS.md`**

Mark F1-13 as complete (`[x]`) and update the progress summary table.

- [ ] **Step 6: Final commit**

```bash
git add TAREAS.md
git commit -m "docs: mark F1-13 complete in TAREAS.md"
```
