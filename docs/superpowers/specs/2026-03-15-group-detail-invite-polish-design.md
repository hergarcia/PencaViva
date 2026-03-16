# Group Detail — Invite Code Section Polish

**Goal:** Make the invite code easy to copy with a single tap, replace the deprecated clipboard API, and polish the invite card UI. Scoped to the invite section only — the rest of the group detail screen is a placeholder pending future features (leaderboard, participants, match results).

---

## Scope

**In scope:**

- Tap-to-copy invite code pill
- Split copy actions: "Copy code" (8-char code) and "Copy link" (full URL)
- Inline "Copied!" feedback (no external toast library)
- Migrate from deprecated `react-native` `Clipboard` to `@react-native-clipboard/clipboard`

**Out of scope:**

- Group header (name, description, member count)
- QR code size, content, or surrounding spacing
- "Share with friends" button
- Overall screen layout (to be redesigned when leaderboard/participants land)
- Haptic feedback (deferred — no haptic library is installed yet)

---

## UI Design

### Invite Card — Vertical Layout

The invite card (`backgroundColor: colors.surface`, `borderRadius: 12`, `padding: 20`, `alignItems: center`) contains elements in this exact vertical order:

```
INVITE CODE label
[code pill]                           ← tappable, testID="invite-code"
"Code copied!" / "Link copied!"       ← conditional feedback, hidden when null
[QR code]                             ← unchanged, same size and spacing
[Copy code]   [Copy link]             ← side-by-side row, marginTop: 20
```

### Invite Code Pill

A `TouchableOpacity` (`testID="invite-code"`) wrapping a horizontal row:

- Background: `colors.surface`
- Border: `colors.primary + "4D"` (30% opacity hex), 1.5px
- Border radius: 10px
- `flexDirection: "row"`, `alignItems: "center"`, `justifyContent: "space-between"`
- `paddingVertical: 12`, `paddingHorizontal: 18`
- `width: "100%"`
- Left: code text — `color: colors.primary`, `fontSize: 26`, `fontWeight: "700"`, `letterSpacing: 6`
- Right: `<Ionicons name="copy-outline" size={18} color={colors.primary} />`

**On press:** `copyWithFeedback(group.invite_code, "code")`

**Note:** `group.invite_code` is always present when the screen renders (required field in the DB schema, non-nullable). No null guard needed.

### Feedback Line

Rendered between the code pill and the QR code. No `testID` — asserted in tests by text content.

```tsx
{
  copiedState !== null ? (
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
  ) : null;
}
```

Only one message is ever visible at a time (enforced by the state model).

### Copy Action Buttons

A `View` with `flexDirection: "row"`, `gap: 8`, `width: "100%"`, `marginTop: 20` — replaces the current single "Copy invite link" `TouchableOpacity`.

**Copy code** (`testID="copy-code-button"`):

- `flex: 1`
- `borderWidth: 1`, `borderColor: colors.primary`
- `borderRadius: 8`, `paddingVertical: 10`
- `flexDirection: "row"`, `alignItems: "center"`, `justifyContent: "center"`, `gap: 6`
- Icon: `<Ionicons name="copy-outline" size={16} color={colors.primary} />`
- Text: `"Copy code"`, `color: colors.primary`, `fontSize: 13`, `fontWeight: "600"`
- On press: `copyWithFeedback(group.invite_code, "code")`

**Copy link** (`testID="copy-link-button"`):

- `flex: 1`
- `borderWidth: 1`, `borderColor: colors.surfaceBorder`
- `borderRadius: 8`, `paddingVertical: 10`
- `flexDirection: "row"`, `alignItems: "center"`, `justifyContent: "center"`, `gap: 6`
- Icon: `<Ionicons name="link-outline" size={16} color={colors.textSecondary} />`
- Text: `"Copy link"`, `color: colors.textSecondary`, `fontSize: 13`, `fontWeight: "600"`
- On press: `copyWithFeedback(inviteUrl, "link")`

**`inviteUrl`** is constructed as: `` `${APP_BASE_URL}/join/${group.invite_code}` `` — same as the current code. `APP_BASE_URL` is imported from `@lib/constants`.

---

## State

```typescript
const [copiedState, setCopiedState] = useState<"code" | "link" | null>(null);
const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// Cleanup on unmount to prevent setState on unmounted component
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

The `clearTimeout` guard ensures that rapid sequential taps show only the most recent action's feedback.

---

## Clipboard Migration

Install:

```bash
npx expo install @react-native-clipboard/clipboard
```

> **Important:** `@react-native-clipboard/clipboard` is a native module. It is **not available in Expo Go** — a development client rebuild (EAS) is required after adding this dependency.

Replace existing clipboard usage:

```typescript
// Before (deprecated, remove this)
const Clipboard = require("react-native").Clipboard;
Clipboard.setString(inviteUrl);
```

```typescript
// After
import Clipboard from "@react-native-clipboard/clipboard";
// used as: Clipboard.setString(value)
```

---

## Files Changed

| File                                                 | Change                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `app/(tabs)/groups/[id].tsx`                         | Implement tap-to-copy pill, split copy buttons, inline feedback, clipboard migration |
| `src/__mocks__/@react-native-clipboard/clipboard.ts` | New manual mock for Jest                                                             |
| `jest.config.js`                                     | Add `moduleNameMapper` entry for `@react-native-clipboard/clipboard`                 |
| `src/__tests__/navigation/group-screens.test.tsx`    | Add clipboard mock import + new test cases                                           |
| `package.json` / `package-lock.json`                 | Add `@react-native-clipboard/clipboard`                                              |

---

## Tests

### Manual mock

Add `src/__mocks__/@react-native-clipboard/clipboard.ts`:

```typescript
const Clipboard = {
  setString: jest.fn(),
  getString: jest.fn().mockResolvedValue(""),
};
export default Clipboard;
```

### Jest config

Add to `moduleNameMapper` in `jest.config.js` (unit project):

```javascript
"^@react-native-clipboard/clipboard$":
  "<rootDir>/src/__mocks__/@react-native-clipboard/clipboard.ts",
```

### Test cases

In `src/__tests__/navigation/group-screens.test.tsx`, add at the top alongside existing mocks:

```typescript
jest.mock("@react-native-clipboard/clipboard");
/* eslint-disable @typescript-eslint/no-require-imports */
const Clipboard = require("@react-native-clipboard/clipboard").default;
/* eslint-enable @typescript-eslint/no-require-imports */
```

Add a new `describe("Invite code section")` block (requires `useGroupDetail` mock to return a loaded group with `invite_code: "ABCD1234"`):

- `testID="invite-code"` is present (preserves existing test)
- Tapping `testID="invite-code"` calls `Clipboard.setString("ABCD1234")`
- Tapping `testID="copy-code-button"` calls `Clipboard.setString("ABCD1234")`
- Tapping `testID="copy-link-button"` calls `Clipboard.setString("https://pencaviva.app/join/ABCD1234")`
- After tapping `testID="invite-code"`, `"Code copied!"` text is visible
- After tapping `testID="copy-link-button"`, `"Link copied!"` text is visible
- `"Code copied!"` text is not visible on initial render

Existing tests must keep passing:

- `testID="invite-code"` findable (now on the `TouchableOpacity` pill wrapper)
- `testID="share-button"` still present
