# Group Detail Invite Code Section Polish — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the invite code section in the group detail screen: add a tap-to-copy code pill, split copy actions into "Copy code" and "Copy link", show inline "Copied!" feedback, and migrate from the deprecated `react-native` Clipboard to `@react-native-clipboard/clipboard`.

**Architecture:** All changes are confined to a single screen file (`app/(tabs)/groups/[id].tsx`) plus infrastructure for testing the new native clipboard module. A manual Jest mock replaces the native module in tests, and a `moduleNameMapper` entry routes Jest imports to that mock. No new components or hooks are needed — state is local to the screen.

**Tech Stack:** React Native, Expo (SDK 55), TypeScript, `@react-native-clipboard/clipboard`, Jest + React Native Testing Library, Ionicons (already installed via `@expo/vector-icons`)

---

## File Map

| File                                                 | Action        | What changes                                                                                                                |
| ---------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `app/(tabs)/groups/[id].tsx`                         | Modify        | Replace clipboard require + single button with tap-to-copy pill, two copy buttons, inline feedback, proper Clipboard import |
| `src/__mocks__/@react-native-clipboard/clipboard.ts` | Create        | Manual Jest mock for the native clipboard module                                                                            |
| `jest.config.js`                                     | Modify        | Add `moduleNameMapper` entry routing `@react-native-clipboard/clipboard` to the mock                                        |
| `src/__tests__/navigation/group-screens.test.tsx`    | Modify        | Add clipboard mock + 7 new test cases in `describe("Invite code section")`                                                  |
| `package.json` / `package-lock.json`                 | Auto-modified | `npx expo install @react-native-clipboard/clipboard`                                                                        |

---

## Chunk 1: Infrastructure (mock, jest config, package install)

### Task 1: Install `@react-native-clipboard/clipboard`

**Files:**

- Auto-modified: `package.json`, `package-lock.json`

- [ ] **Step 1: Install the package**

```bash
npx expo install @react-native-clipboard/clipboard
```

Expected output: package added to `package.json` dependencies. No errors.

> **Note:** This is a native module. It is **not usable in Expo Go** — a dev client rebuild (EAS) is required to use it on a real device. Tests use a Jest mock (Task 2), so tests work without a rebuild.

- [ ] **Step 2: Verify it appears in package.json**

```bash
grep "@react-native-clipboard" package.json
```

Expected: `"@react-native-clipboard/clipboard": "..."` under `dependencies`.

---

### Task 2: Create the manual Jest mock

**Files:**

- Create: `src/__mocks__/@react-native-clipboard/clipboard.ts`

- [ ] **Step 1: Create the directory and mock file**

Create `src/__mocks__/@react-native-clipboard/clipboard.ts` with this exact content:

```typescript
const Clipboard = {
  setString: jest.fn(),
  getString: jest.fn().mockResolvedValue(""),
};
export default Clipboard;
```

- [ ] **Step 2: Verify the file exists and has correct content**

```bash
cat src/__mocks__/@react-native-clipboard/clipboard.ts
```

Expected: the three-function mock object exported as default.

---

### Task 3: Add `moduleNameMapper` entry to Jest config

**Files:**

- Modify: `jest.config.js` (unit project `moduleNameMapper` block, around line 26–48)

Context: Jest does **not** auto-discover mocks in `src/__mocks__/` for scoped packages like `@react-native-clipboard/clipboard`. A `moduleNameMapper` entry is required to route the import to the mock file.

- [ ] **Step 1: Add the entry to `moduleNameMapper` in the unit project**

Open `jest.config.js`. In the `moduleNameMapper` object of the `unit` project (the first project in the `projects` array), add this entry after the `react-native-qrcode-svg` entry:

```javascript
"^@react-native-clipboard/clipboard$":
  "<rootDir>/src/__mocks__/@react-native-clipboard/clipboard.ts",
```

The full `moduleNameMapper` block should end like:

```javascript
"^react-native-qrcode-svg$":
  "<rootDir>/src/__mocks__/react-native-qrcode-svg.ts",
"^react-native-svg$": "<rootDir>/src/__mocks__/react-native-svg.ts",
"^@react-native-clipboard/clipboard$":
  "<rootDir>/src/__mocks__/@react-native-clipboard/clipboard.ts",
```

- [ ] **Step 2: Run existing tests to confirm nothing is broken**

```bash
npm run test:unit -- --testPathPattern="group-screens"
```

Expected: all tests in `group-screens.test.tsx` pass (currently 4 tests).

- [ ] **Step 3: Commit infrastructure**

```bash
git add package.json package-lock.json src/__mocks__/@react-native-clipboard/clipboard.ts jest.config.js
git commit -m "feat(groups): add @react-native-clipboard/clipboard with Jest mock and moduleNameMapper"
```

---

## Chunk 2: Tests (RED phase)

### Task 4: Add clipboard tests to group-screens.test.tsx

**Files:**

- Modify: `src/__tests__/navigation/group-screens.test.tsx`

Context: The existing file has 4 tests under `describe("Group nested screens")`. We add a new `describe("Invite code section")` block with 7 tests. The mock for `@react-native-clipboard/clipboard` must be set up at the top of the file.

- [ ] **Step 1: Add clipboard mock setup at the top of the test file**

After the existing `jest.mock` calls (after the `useGroupDetail` mock, around line 30), add:

```typescript
jest.mock("@react-native-clipboard/clipboard");
/* eslint-disable @typescript-eslint/no-require-imports */
const Clipboard = require("@react-native-clipboard/clipboard").default;
/* eslint-enable @typescript-eslint/no-require-imports */
```

- [ ] **Step 2: Add a helper at the top of the file for the loaded group mock**

After the `const Clipboard = ...` lines, add:

```typescript
const loadedGroup = {
  id: "7",
  name: "My Penca",
  description: null,
  avatar_url: null,
  invite_code: "ABCD1234",
  created_by: "u1",
  member_count: 5,
  role: "admin" as const,
};
```

- [ ] **Step 3: Add the `describe("Invite code section")` block**

After the closing `});` of `describe("Group nested screens")`, add:

```typescript
describe("Invite code section", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { useGroupDetail } = require("@hooks/use-group-detail");
  /* eslint-enable @typescript-eslint/no-require-imports */

  beforeEach(() => {
    jest.clearAllMocks();
    (useGroupDetail as jest.Mock).mockReturnValue({
      group: loadedGroup,
      loading: false,
      error: null,
    });
  });

  it("renders testID='invite-code' pill", () => {
    render(<GroupDetailScreen />);
    expect(screen.getByTestId("invite-code")).toBeTruthy();
  });

  it("tapping invite-code pill copies the code", () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId("invite-code"));
    expect(Clipboard.setString).toHaveBeenCalledWith("ABCD1234");
  });

  it("tapping copy-code-button copies the code", () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId("copy-code-button"));
    expect(Clipboard.setString).toHaveBeenCalledWith("ABCD1234");
  });

  it("tapping copy-link-button copies the full URL", () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId("copy-link-button"));
    expect(Clipboard.setString).toHaveBeenCalledWith(
      "https://pencaviva.app/join/ABCD1234",
    );
  });

  it("shows 'Code copied!' after tapping invite-code pill", () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId("invite-code"));
    expect(screen.getByText("Code copied!")).toBeTruthy();
  });

  it("shows 'Link copied!' after tapping copy-link-button", () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId("copy-link-button"));
    expect(screen.getByText("Link copied!")).toBeTruthy();
  });

  it("does not show 'Code copied!' on initial render", () => {
    render(<GroupDetailScreen />);
    expect(screen.queryByText("Code copied!")).toBeNull();
  });
});
```

> **Note:** `fireEvent` must be imported. Add it to the import line:
>
> ```typescript
> import { render, screen, fireEvent } from "@testing-library/react-native";
> ```

- [ ] **Step 4: Run the new tests to confirm they FAIL (RED)**

```bash
npm run test:unit -- --testPathPattern="group-screens"
```

Expected: 7 new tests fail. Failures like `Unable to find an element with testId: invite-code` (for the pill tests) and `Unable to find an element with text: Code copied!` confirm correct RED state.

---

## Chunk 3: Implementation (GREEN phase)

### Task 5: Rewrite the invite section in `app/(tabs)/groups/[id].tsx`

**Files:**

- Modify: `app/(tabs)/groups/[id].tsx`

Context: The current file (200 lines) uses a `<Text testID="invite-code">` and a single `TouchableOpacity testID="copy-button"` with the deprecated clipboard require. We replace the invite section only — the header and share button are unchanged.

- [ ] **Step 1: Add the new import and state**

Replace the existing import block at the top of the file. Change:

```typescript
import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from "react-native";
```

To:

```typescript
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from "react-native";
import Clipboard from "@react-native-clipboard/clipboard";
```

- [ ] **Step 2: Add state declarations inside the component**

Inside `GroupDetailScreen`, after the `inviteUrl` line, add:

```typescript
const [copiedState, setCopiedState] = useState<"code" | "link" | null>(null);
const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  return () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
  };
}, []);

function copyWithFeedback(text: string, type: "code" | "link") {
  Clipboard.setString(text);
  if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
  setCopiedState(type);
  copyTimeoutRef.current = setTimeout(() => setCopiedState(null), 1500);
}
```

- [ ] **Step 3: Replace the invite section JSX**

Find the invite section (the `<View style={{ marginTop: 32, backgroundColor: colors.surface, ... }}>` block). Replace the entire inner content (the `<Text>INVITE CODE</Text>`, the `<Text testID="invite-code">`, the QR `<View>`, and the old `<TouchableOpacity testID="copy-button">`) with:

```tsx
{
  /* Invite section */
}
<View
  style={{
    marginTop: 32,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  }}
>
  <Text
    style={{
      color: colors.textSecondary,
      fontSize: 12,
      letterSpacing: 1,
      marginBottom: 8,
    }}
  >
    INVITE CODE
  </Text>

  {/* Tap-to-copy code pill */}
  <TouchableOpacity
    testID="invite-code"
    onPress={() => copyWithFeedback(group.invite_code, "code")}
    style={{
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.primary + "4D",
      borderRadius: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 18,
      width: "100%",
    }}
  >
    <Text
      style={{
        color: colors.primary,
        fontSize: 26,
        fontWeight: "700",
        letterSpacing: 6,
      }}
    >
      {group.invite_code}
    </Text>
    <Ionicons name="copy-outline" size={18} color={colors.primary} />
  </TouchableOpacity>

  {/* Inline copy feedback */}
  {copiedState !== null ? (
    <Text
      style={{
        color: colors.primary,
        fontSize: 12,
        marginTop: 6,
        marginBottom: 4,
      }}
    >
      {copiedState === "code" ? "Code copied!" : "Link copied!"}
    </Text>
  ) : null}

  {/* QR code — unchanged */}
  <View
    style={{
      marginTop: 24,
      backgroundColor: "#FFFFFF",
      padding: 8,
      borderRadius: 8,
    }}
  >
    <QRCode value={inviteUrl} size={200} color="#000000" />
  </View>

  {/* Copy action buttons */}
  <View
    style={{
      flexDirection: "row",
      gap: 8,
      width: "100%",
      marginTop: 20,
    }}
  >
    {/* Copy code */}
    <TouchableOpacity
      testID="copy-code-button"
      onPress={() => copyWithFeedback(group.invite_code, "code")}
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: 8,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <Ionicons name="copy-outline" size={16} color={colors.primary} />
      <Text
        style={{
          color: colors.primary,
          fontSize: 13,
          fontWeight: "600",
        }}
      >
        Copy code
      </Text>
    </TouchableOpacity>

    {/* Copy link */}
    <TouchableOpacity
      testID="copy-link-button"
      onPress={() => copyWithFeedback(inviteUrl, "link")}
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderRadius: 8,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <Ionicons name="link-outline" size={16} color={colors.textSecondary} />
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 13,
          fontWeight: "600",
        }}
      >
        Copy link
      </Text>
    </TouchableOpacity>
  </View>
</View>;
```

- [ ] **Step 4: Add `Ionicons` import if not already present**

Check the import block. If `Ionicons` is not already imported, add:

```typescript
import { Ionicons } from "@expo/vector-icons";
```

- [ ] **Step 5: Run the tests (GREEN)**

```bash
npm run test:unit -- --testPathPattern="group-screens"
```

Expected: all 11 tests pass (4 existing + 7 new).

- [ ] **Step 6: Run full CI checks**

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:ci
```

Fix any formatting or lint issues (`npm run format`, `npm run lint:fix`). All checks must pass.

- [ ] **Step 7: Commit the implementation**

```bash
git add app/(tabs)/groups/[id].tsx src/__tests__/navigation/group-screens.test.tsx
git commit -m "feat(groups): polish invite code section — tap-to-copy pill, split copy buttons, inline feedback, clipboard migration"
```

---

## Final Checklist

- [ ] `npx expo install @react-native-clipboard/clipboard` completed
- [ ] `src/__mocks__/@react-native-clipboard/clipboard.ts` created
- [ ] `jest.config.js` has `moduleNameMapper` entry for clipboard
- [ ] 7 new tests added and passing
- [ ] `app/(tabs)/groups/[id].tsx` uses `Clipboard` from `@react-native-clipboard/clipboard`
- [ ] Old `require("react-native").Clipboard` removed
- [ ] `testID="copy-button"` replaced by `testID="copy-code-button"` and `testID="copy-link-button"`
- [ ] `testID="invite-code"` now on `TouchableOpacity` (not `Text`)
- [ ] `testID="share-button"` still present and unchanged
- [ ] All CI checks pass (`format:check`, `lint`, `typecheck`, `test:ci`)
