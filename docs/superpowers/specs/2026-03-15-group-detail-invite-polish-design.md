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
- QR code size or placement
- "Share with friends" button
- Overall screen layout (to be redesigned when leaderboard/participants land)

---

## UI Design

### Invite Code Pill

The 8-character invite code is displayed inside a tappable container:

- Background: `colors.surface` (`#1A1A2E`)
- Border: `colors.primary` at 30% opacity, 1.5px
- Border radius: 10px
- Code text: `colors.primary` (`#00D4AA`), 28px, bold, letter-spacing 8
- Right side: small copy icon (`Ionicons` `copy-outline`, 18px, `colors.primary`)
- Padding: 14px horizontal, 12px vertical

**On press:** copies the 8-char code via `@react-native-clipboard/clipboard`, sets `codeCopied = true` for 1500ms, then resets.

### "Copied!" Feedback

A single line of text below the code pill:

- Text: `"Copied!"` in `colors.primary`, 12px
- Visible only when `codeCopied === true` or `linkCopied === true`
- Shows which was copied: `"Code copied!"` or `"Link copied!"`
- No animation library — plain conditional render is sufficient

### Copy Action Buttons

Two buttons side-by-side below the QR code, replacing the current single "Copy invite link" button:

**Copy code** (primary):

- Border: `colors.primary`, 1px
- Text: `colors.primary`
- Icon: `copy-outline` (Ionicons)
- Action: copies 8-char invite code, sets `codeCopied = true`

**Copy link** (secondary):

- Border: `colors.surfaceBorder`
- Text: `colors.textSecondary`
- Icon: `link-outline` (Ionicons)
- Action: copies full URL (`APP_BASE_URL/join/<invite_code>`), sets `linkCopied = true`

Both buttons: `flex: 1`, `borderRadius: 8`, `paddingVertical: 10`, icon + text row with `gap: 6`.

---

## Clipboard Migration

Replace:

```typescript
const Clipboard = require("react-native").Clipboard;
Clipboard.setString(inviteUrl);
```

With:

```typescript
import Clipboard from "@react-native-clipboard/clipboard";
Clipboard.setString(value);
```

Install: `npx expo install @react-native-clipboard/clipboard`

This package is Expo-compatible and doesn't require a native rebuild in Expo Go.

---

## State

Add to `GroupDetailScreen`:

```typescript
const [codeCopied, setCodeCopied] = useState(false);
const [linkCopied, setLinkCopied] = useState(false);
```

Helper:

```typescript
function copyWithFeedback(text: string, setter: (v: boolean) => void) {
  Clipboard.setString(text);
  setter(true);
  setTimeout(() => setter(false), 1500);
}
```

---

## Files Changed

| File                                 | Change                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| `app/(tabs)/groups/[id].tsx`         | Implement tap-to-copy pill, split copy buttons, inline feedback, clipboard migration |
| `package.json` / `package-lock.json` | Add `@react-native-clipboard/clipboard`                                              |

---

## Tests

Update `src/__tests__/navigation/group-screens.test.tsx`:

- Mock `@react-native-clipboard/clipboard`
- Test: tapping invite code pill calls `Clipboard.setString` with the 8-char code
- Test: tapping "Copy code" button calls `Clipboard.setString` with the 8-char code
- Test: tapping "Copy link" button calls `Clipboard.setString` with the full URL
- Test: "Code copied!" text appears after tapping code pill
- Test: "Link copied!" text appears after tapping copy link button
- Keep existing tests passing
