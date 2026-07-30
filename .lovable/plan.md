# Offline mode with auto-sync

Students can add, edit and delete expenses with no internet. Changes are saved on the device and pushed to the database automatically the moment connectivity returns.

## How it will behave

- Adding an expense offline saves instantly and shows in the list with a "Pending sync" chip.
- Editing/deleting works offline too, including editing an item that hasn't synced yet.
- A slim status bar above the bottom nav shows: "Offline — 3 changes waiting" / "Syncing…" / "All synced".
- The last loaded expense list stays visible offline (served from the device cache), so Home and Reports still show real numbers.
- Receipt images picked while offline are stored on the device and uploaded during sync.
- A manual "Sync now" action in Profile for when auto-sync needs a nudge.

## Technical approach

**Local storage layer (`src/lib/offline-db.ts`)**
- IndexedDB via `idb` with two stores:
  - `expenses` — local mirror of the user's rows (server rows + locally created ones, keyed by id).
  - `outbox` — ordered queue of `{ id, op: 'insert'|'update'|'delete', payload, receiptBlob?, createdAt, attempts }`.
- Locally created rows get a client-side UUID used as the real DB id, so inserts are idempotent and edits before sync just patch the same record.

**Query cache persistence**
- Persist TanStack Query with `@tanstack/query-sync-storage-persister` + `persistQueryClient` (localStorage) in `src/router.tsx`, so previously loaded pages render offline instantly.

**Read path**
- Expense queries read from IndexedDB first, then reconcile with the server response when a request succeeds; server rows overwrite local ones except where an outbox entry is still pending for that id.

**Write path (`src/lib/offline-sync.ts`)**
- All mutations in `dashboard.tsx` go through `queueMutation()`: write to IndexedDB + outbox, update the query cache optimistically, then attempt an immediate flush if `navigator.onLine`.
- `flushOutbox()` processes entries in order: insert → upsert row, update → update by id, delete → remove receipt then delete row. Success removes the entry; failures increment `attempts` with exponential backoff (entries failing with a permanent RLS/validation error are dropped with a toast).
- Triggers: `online` event, tab focus/visibility change, app start, a 30s interval while pending entries exist, and Capacitor's `App` resume event on Android.

**UI**
- `src/hooks/useOnlineStatus.ts` — online/offline + pending-count state from the sync module.
- `src/components/SyncStatusBar.tsx` — the status strip, rendered next to `BottomNav`.
- `dashboard.tsx` — pending badge per row, submit works while offline, delete/edit routed through the queue.
- `profile.tsx` — "Sync now" button and last-synced timestamp.
- `reports.tsx` — reads the same cached/local dataset so it works offline.

**Service worker**
- Existing `vite-plugin-pwa` config already caches the shell; no changes needed beyond leaving Supabase API calls uncached (they must always hit the network or fail into the queue).

## Notes

- Offline behaviour is only fully testable in the published app or the native Android build — the Lovable editor preview does not run the service worker.
- Sign-in still requires internet the first time; after that the session persists and offline capture works.
