# Real-Time Sync Architecture

## Overview

CollabDocs uses [Convex](https://convex.dev) as its backend, which provides real-time reactive queries over WebSocket. This document describes how document edits flow from a user's browser to the server and back to all connected clients.

---

## Data Flow

```
Browser (User A)                  Convex Backend                  Browser (User B)
─────────────────                 ─────────────────               ─────────────────
User types
  │
  ▼
Editor onChange
  │
  ▼
Debounce (1000 ms)
  │
  ▼
SyncManager.onLocalChange()
  │  state → "pending"
  ▼
SyncManager.onSaveAttempt()
  │
  ▼
documents.update mutation ──────► db.patch(id, { content, title })
                                          │
                                          ▼
                             updatedAt = Date.now()
                             (mutation completes)
                                          │
                        ┌─────────────────┴──────────────────┐
                        │                                     │
                        ▼                                     ▼
             User A reactive query               User B reactive query
             receives new updatedAt             receives new content
                        │                                     │
                        ▼                                     ▼
             SyncManager.onSaveSuccess()        SyncManager.onServerUpdate()
               state → "synced"                (no pending changes → silent)
```

---

## Conflict Detection

A conflict is detected when:

1. User A has unsaved local changes (state = "pending"), AND
2. A server update arrives with a timestamp newer than the last known server timestamp, AND
3. That update was **not** User A's own save coming back (see below)

```
User A (pending)          Server              User B
──────────────────        ──────────          ──────────────────
[typing…]                                     [typing…]
                                              mutation → updatedAt=T2
                          T2 pushed
onServerUpdate(T2)
hasPendingChanges=true
T2 > lastKnownT1
    ↓
state → "conflict"
Conflict banner shown
```

### Own-Save Echo Suppression

`documents.update` returns the `updatedAt` it wrote, and `onSaveSuccess`
records that value. The subscription then delivers the document carrying the
same timestamp, and `onServerUpdate` ignores anything at or behind what it
already knows — so a save's own echo is recognised by being the same write.

```
User A
──────────────────────────────────────────────────────────
mutation sent →
onSaveAttempt()
                  ← mutation ack, returns updatedAt=T3
onSaveSuccess(T3)
  serverTimestamp = T3   (the server's value, not Date.now())
  state → "synced"
                  ← reactive query fires with T3
onServerUpdate(T3)
  T3 is not > T3 → ignored (not a conflict)
```

Two earlier approaches were wrong here, and the reasons are worth keeping:

- A `_savedJustNow` flag cleared on a `setTimeout(…, 0)` guarded a network
  round trip with a single tick, so it had always expired by the time the echo
  arrived. It appeared to work only because a completed save leaves no pending
  changes; anyone still typing during the round trip saw their own edit
  reported as a conflict.
- Recording `Date.now()` at save time compared a browser clock against a server
  clock, so which write looked newer depended on the skew between the two.

The same comparison also discards out-of-order deliveries, which arrive
carrying a timestamp behind one already seen.

---

## Conflict Resolution: Last-Write-Wins

The `ConflictResolver` implements LWW based on server timestamps:

- **Local wins** if `local.serverTimestamp > remote.serverTimestamp`
- **Remote wins** otherwise (ties go to remote — server is authoritative)

This is consistent with Convex's own mutation model, where the last `db.patch()` to complete wins.

When a conflict is detected the UI presents a banner. The user can:
- **Reload changes** — call `manager.acknowledgeConflict()`, which clears `hasPendingChanges` and resets state to "synced". The editor content updates automatically because the Convex reactive query already holds the latest server content.
- **Do nothing** — the conflict banner persists until they act.

---

## Retry with Exponential Backoff

If a save fails (network error, Convex rate limit, etc.) the `SyncManager` retries up to 3 times:

```
Attempt 1 fails → wait 1 s  → retry
Attempt 2 fails → wait 2 s  → retry
Attempt 3 fails → wait 4 s  → retry
Attempt 4 fails → state = "error" (user must manually retry)
```

Formula: `delay = min(1000 × 2^(retryCount−1), 30000)`

---

## State Machine

```
              onLocalChange()
   ┌─────────────────────────────────────────┐
   │                                         ▼
"synced" ──────────────────────────────► "pending"
   ▲                                         │
   │  onSaveSuccess()               onSaveFailure() × 3
   └─────────────────────────────────────────┤
                                             │
                             onServerUpdate() (conflict)
                                             │
                                             ▼
                                        "conflict"
                                             │
                                  acknowledgeConflict()
                                             │
                                             ▼
                                         "synced"

                          onSaveFailure() × MAX_RETRIES
                                             │
                                             ▼
                                          "error"
```

---

## Latency Expectations

| Operation | Typical | P95 |
|---|---|---|
| Mutation round-trip (same region) | 50–100 ms | 200 ms |
| Reactive query propagation | 50–150 ms | 300 ms |
| End-to-end (edit → other user sees) | 100–300 ms | 500 ms |
| Debounce delay (intentional) | 1000 ms | — |

The 1 s debounce is the dominant latency for most edits. It reduces mutation volume by ~10× compared to firing on every keystroke.

---

## Key Files

| File | Purpose |
|---|---|
| `lib/types/sync.ts` | `SyncState`, `DocumentVersion`, `ConflictResolution`, `SyncEvent` types |
| `lib/sync/conflictResolver.ts` | `ConflictResolver` — LWW logic and conflict detection |
| `lib/sync/syncManager.ts` | `SyncManager` class + `useSyncManager` React hook |
| `components/editor/DocumentEditor.tsx` | Integrates `useSyncManager`; renders conflict banner |
| `convex/documents.ts` | `update` mutation; derives `updatedAt` server-side |
