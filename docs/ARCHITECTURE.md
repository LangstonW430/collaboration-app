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
3. That update was **not** caused by User A's own save (the `_savedJustNow` flag suppresses own-echo updates)

```
User A (pending)          Server              User B
──────────────────        ──────────          ──────────────────
[typing…]                                     [typing…]
                                              mutation → updatedAt=T2
                          T2 pushed
onServerUpdate(T2)
hasPendingChanges=true
T2 > lastKnownT1
_savedJustNow=false
    ↓
state → "conflict"
Conflict banner shown
```

### Own-Save Echo Suppression

```
User A
──────────────────────────────────────────────────────────
mutation sent →
onSaveAttempt()
                  ← mutation ack + new updatedAt=T3
onSaveSuccess(T3)
  _savedJustNow = true
  state → "synced"
                  ← reactive query fires with T3
onServerUpdate(T3)
  _savedJustNow=true → ignored (not a conflict)
  setTimeout → _savedJustNow = false
```

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
