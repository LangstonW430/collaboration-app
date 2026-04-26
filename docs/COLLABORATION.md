# Real-Time Collaboration Guide

## How Sync Works

Every time a user edits a document, changes are **debounced for 1 second** before being sent to the server. This keeps mutation volume low while still feeling real-time to collaborators (they see updates within ~1–2 seconds of a keystroke pause).

Under the hood, Convex pushes updated document content to all subscribed clients over WebSocket the moment a mutation lands. No polling, no manual refresh.

---

## When Sync Happens

| Trigger | Behaviour |
|---|---|
| User types / pastes | 1 s debounce starts (or resets) |
| Debounce fires | `documents.update` mutation sent |
| Mutation succeeds | `updatedAt` advances; all subscribers receive new content |
| Mutation fails | Retry with exponential backoff (1 s → 2 s → 4 s → error state) |
| Another user saves | Reactive query fires; editor re-renders with new content |

---

## Sync Status Indicator

The toolbar shows the current sync state:

| State | Label | When |
|---|---|---|
| `synced` | "Saved" (green) | All changes are on the server |
| `pending` | "Saving…" (yellow) | Unsaved local changes exist |
| `conflict` | "Conflict" (orange) | Server advanced while you had pending changes |
| `error` | "Save failed" (red) | Retries exhausted; manual action needed |

---

## What Causes a Conflict

A conflict is raised when **all three conditions hold simultaneously**:

1. You have unsaved local changes (state = "pending")
2. Another user's save lands on the server
3. The server's `updatedAt` is newer than the last timestamp you successfully synced

**Before conflict:**
```
User A                   Server
──────────────────────   ─────────────────────
state=pending            updatedAt = T1
(typing…)
```

**Conflict triggered:**
```
User A                   Server                User B
──────────────────────   ─────────────────────  ────────────────
state=pending            updatedAt = T1         saves → T2
                         T2 pushed to A
onServerUpdate(T2)
  hasPendingChanges=true
  T2 > T1
  → state = "conflict"
Banner shown ◄───────────────────────────────────────────────────
```

---

## Resolving a Conflict

When a conflict banner appears, the user has one option:

**"Reload changes"** — discards local unsaved edits and loads the latest server content. The editor re-renders automatically because the Convex reactive query already holds the server state. Clicking this calls `manager.acknowledgeConflict()`, which resets the sync state to "synced".

If the user does nothing, the banner stays until they act. Their pending edits remain in the editor. If they keep typing, the next debounce save will overwrite the remote content (last-write-wins).

---

## Last-Write-Wins Explained

CollabDocs uses **last-write-wins (LWW)** conflict resolution, which means:

- Whichever `documents.update` mutation arrives at the Convex server last wins
- This is the same model Convex uses natively for `db.patch`
- If two users finish typing at the same millisecond, the server commit order decides the outcome

LWW is appropriate here because document edits are high-frequency and short-lived. The alternative (operational transforms or CRDTs) would require significant infrastructure complexity for a marginal user benefit in a typical async document editing scenario.

---

## Latency Expectations

- **Typical round-trip** (edit → collaborator sees): 1–2 seconds (dominated by the 1 s debounce)
- **Mutation latency** (network + Convex processing): 50–200 ms
- **Reactive push latency** (Convex → browser): 50–150 ms

For real-time cursor/presence features (not yet implemented), the debounce would be bypassed and raw latency would be ~100–300 ms end-to-end.

---

## How to Test Real-Time Features

### Manual test (two browser windows)

1. Open the same document in two separate browser windows (or two different browsers)
2. Type in window A — within ~2 seconds, window B should update
3. Type simultaneously in both windows — observe conflict detection and resolution

### Simulating a conflict

1. Open document in window A and window B
2. In window A, pause your dev server's network (DevTools → Network → Offline) so saves fail
3. Type in window A (state = pending, retrying)
4. In window B, make an edit and let it save
5. Restore window A's network — the next retry will detect the conflict

### Unit tests

```bash
npx vitest run __tests__/unit/sync/conflictResolver.test.ts
```

### End-to-end tests

```bash
npx playwright test __tests__/e2e/realtime.spec.ts
```

---

## Inviting Collaborators

Use the **Share** button in the document toolbar. Enter an email address and choose a role:

- **Editor** — can view and edit the document
- **Viewer** — can view but not edit

Invites are stored in the `collaborators` table and show as "Invite pending" until the recipient accepts. Acceptance is automatic when they log in and visit the document link.
