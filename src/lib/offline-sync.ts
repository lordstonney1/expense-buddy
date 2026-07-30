import { supabase } from "@/integrations/supabase/client";
import {
  addOutbox,
  allOutbox,
  deleteLocalExpense,
  deleteOutbox,
  getLocalExpense,
  localExpenses,
  outboxForExpense,
  putLocalExpense,
  putOutbox,
  replaceServerSnapshot,
  type OfflineExpense,
  type OutboxEntry,
} from "./offline-db";

const LAST_SYNC_KEY = "ceditrack:last-synced-at";
const MAX_ATTEMPTS = 8;

export type SyncState = {
  online: boolean;
  pending: number;
  syncing: boolean;
  lastSyncedAt: number | null;
};

let state: SyncState = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  pending: 0,
  syncing: false,
  lastSyncedAt: null,
};

const listeners = new Set<(s: SyncState) => void>();

export function getSyncState() {
  return state;
}

export function subscribeSync(fn: (s: SyncState) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

async function refreshPending() {
  const entries = await allOutbox();
  setState({ pending: entries.length });
  return entries.length;
}

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extFor(file: File | Blob, name?: string) {
  const n = name ?? (file instanceof File ? file.name : "");
  if (n.includes(".")) return n.split(".").pop()!.toLowerCase();
  return (file.type.split("/")[1] || "bin").toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

/**
 * Try the server first; on any network failure fall back to the device copy.
 * Successful reads refresh the local snapshot (keeping unsynced rows intact).
 */
export async function fetchExpenses(userId: string): Promise<OfflineExpense[]> {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("offline");
    }
    const { data, error } = await supabase
      .from("expenses")
      .select("id, amount, category, description, spent_on, created_at, receipt_path")
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const entries = await allOutbox();
    const pendingIds = new Set(entries.map((e) => e.expenseId));
    const rows = (data ?? []).map((r) => ({
      ...r,
      amount: Number(r.amount),
      user_id: userId,
    })) as OfflineExpense[];
    await replaceServerSnapshot(userId, rows, pendingIds);
  } catch {
    // offline or request failed — serve whatever we have on the device
  }
  return localExpenses(userId);
}

/* ------------------------------------------------------------------ */
/* Writes (always local-first)                                         */
/* ------------------------------------------------------------------ */

export async function queueInsert(input: {
  userId: string;
  amount: number;
  category: string;
  description: string | null;
  spent_on: string;
  receipt?: File | null;
}) {
  const id = newId();
  const now = new Date().toISOString();
  const row: OfflineExpense = {
    id,
    user_id: input.userId,
    amount: input.amount,
    category: input.category,
    description: input.description,
    spent_on: input.spent_on,
    created_at: now,
    receipt_path: null,
    _pending: true,
  };
  await putLocalExpense(row);
  await addOutbox({
    key: newId(),
    expenseId: id,
    userId: input.userId,
    op: "insert",
    payload: {
      id,
      user_id: input.userId,
      amount: input.amount,
      category: input.category,
      description: input.description,
      spent_on: input.spent_on,
    },
    receiptBlob: input.receipt ?? undefined,
    receiptType: input.receipt?.type,
    receiptName: input.receipt?.name,
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: 0,
  });
  await refreshPending();
  void flushOutbox();
  return row;
}

export async function queueUpdate(input: {
  userId: string;
  expenseId: string;
  patch: {
    amount: number;
    category: string;
    description: string | null;
    spent_on: string;
  };
  receipt?: File | null;
  removeReceipt?: boolean;
  currentReceiptPath?: string | null;
}) {
  const existing = await getLocalExpense(input.expenseId);
  const merged: OfflineExpense = {
    id: input.expenseId,
    user_id: input.userId,
    created_at: existing?.created_at ?? new Date().toISOString(),
    receipt_path: input.removeReceipt
      ? null
      : (existing?.receipt_path ?? input.currentReceiptPath ?? null),
    ...input.patch,
    _pending: true,
  };
  await putLocalExpense(merged);
  await addOutbox({
    key: newId(),
    expenseId: input.expenseId,
    userId: input.userId,
    op: "update",
    payload: { ...input.patch, removeReceipt: !!input.removeReceipt },
    receiptBlob: input.receipt ?? undefined,
    receiptType: input.receipt?.type,
    receiptName: input.receipt?.name,
    removeReceiptPath: input.currentReceiptPath ?? null,
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: 0,
  });
  await refreshPending();
  void flushOutbox();
}

export async function queueDelete(input: {
  userId: string;
  expenseId: string;
  receiptPath?: string | null;
}) {
  await deleteLocalExpense(input.expenseId);

  // If this row was created offline and never reached the server, just drop
  // its queued work instead of sending a delete for a row that doesn't exist.
  const pendingForRow = await outboxForExpense(input.expenseId);
  const neverSynced = pendingForRow.some((e) => e.op === "insert");
  for (const e of pendingForRow) await deleteOutbox(e.key);

  if (!neverSynced) {
    await addOutbox({
      key: newId(),
      expenseId: input.expenseId,
      userId: input.userId,
      op: "delete",
      payload: {},
      removeReceiptPath: input.receiptPath ?? null,
      createdAt: Date.now(),
      attempts: 0,
      nextAttemptAt: 0,
    });
  }
  await refreshPending();
  void flushOutbox();
}

/* ------------------------------------------------------------------ */
/* Sync                                                                */
/* ------------------------------------------------------------------ */

async function uploadBlob(userId: string, expenseId: string, blob: Blob, name?: string) {
  const path = `${userId}/${expenseId}-${Date.now()}.${extFor(blob, name)}`;
  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, blob, { upsert: true, contentType: blob.type || "image/jpeg" });
  if (error) throw error;
  return path;
}

/** Postgres error codes that will never succeed on retry. */
function isPermanent(err: unknown) {
  const code = (err as { code?: string } | null)?.code;
  if (!code) return false;
  return /^(22|23|42)/.test(code);
}

let flushing = false;

export async function flushOutbox(): Promise<{ synced: number; failed: number }> {
  if (flushing) return { synced: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await refreshPending();
    return { synced: 0, failed: 0 };
  }
  const entries = await allOutbox();
  if (entries.length === 0) {
    setState({ pending: 0 });
    return { synced: 0, failed: 0 };
  }

  flushing = true;
  setState({ syncing: true });
  let synced = 0;
  let failed = 0;

  try {
    for (const entry of entries) {
      if (entry.nextAttemptAt > Date.now()) continue;
      try {
        await processEntry(entry);
        await deleteOutbox(entry.key);
        synced += 1;
      } catch (err) {
        if (isPermanent(err) || entry.attempts + 1 >= MAX_ATTEMPTS) {
          await deleteOutbox(entry.key);
        } else {
          const attempts = entry.attempts + 1;
          await putOutbox({
            ...entry,
            attempts,
            nextAttemptAt: Date.now() + Math.min(2 ** attempts, 60) * 1000,
          });
        }
        failed += 1;
      }
    }
  } finally {
    flushing = false;
    const pending = await refreshPending();
    const last = synced > 0 ? Date.now() : state.lastSyncedAt;
    if (synced > 0 && typeof localStorage !== "undefined") {
      localStorage.setItem(LAST_SYNC_KEY, String(last));
    }
    setState({ syncing: false, pending, lastSyncedAt: last ?? null });
  }

  return { synced, failed };
}

async function processEntry(entry: OutboxEntry) {
  if (entry.op === "delete") {
    if (entry.removeReceiptPath) {
      await supabase.storage.from("receipts").remove([entry.removeReceiptPath]);
    }
    const { error } = await supabase.from("expenses").delete().eq("id", entry.expenseId);
    if (error) throw error;
    return;
  }

  let receiptPath: string | null | undefined;
  if (entry.receiptBlob) {
    receiptPath = await uploadBlob(
      entry.userId,
      entry.expenseId,
      entry.receiptBlob,
      entry.receiptName,
    );
    if (entry.removeReceiptPath && entry.removeReceiptPath !== receiptPath) {
      await supabase.storage.from("receipts").remove([entry.removeReceiptPath]);
    }
  } else if (entry.op === "update" && entry.payload.removeReceipt) {
    if (entry.removeReceiptPath) {
      await supabase.storage.from("receipts").remove([entry.removeReceiptPath]);
    }
    receiptPath = null;
  }

  if (entry.op === "insert") {
    const { error } = await supabase
      .from("expenses")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert({ ...(entry.payload as any), receipt_path: receiptPath ?? null });
    if (error) throw error;
  } else {
    const { removeReceipt: _removeReceipt, ...rest } = entry.payload as Record<string, unknown>;
    const { error } = await supabase
      .from("expenses")

      .update({
        ...(rest as any),
        ...(receiptPath !== undefined ? { receipt_path: receiptPath } : {}),
      })
      .eq("id", entry.expenseId);
    if (error) throw error;
  }

  const local = await getLocalExpense(entry.expenseId);
  if (local) {
    await putLocalExpense({
      ...local,
      receipt_path: receiptPath !== undefined ? receiptPath : local.receipt_path,
      _pending: false,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

let started = false;

export function initOfflineSync(onSynced?: () => void) {
  if (started || typeof window === "undefined") return () => {};
  started = true;

  const stored = localStorage.getItem(LAST_SYNC_KEY);
  setState({
    online: navigator.onLine,
    lastSyncedAt: stored ? Number(stored) : null,
  });

  const run = async () => {
    const before = state.pending;
    const { synced } = await flushOutbox();
    if (synced > 0 || before > 0) onSynced?.();
  };

  const onOnline = () => {
    setState({ online: true });
    void run();
  };
  const onOffline = () => setState({ online: false });
  const onVisible = () => {
    if (document.visibilityState === "visible") void run();
  };

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  document.addEventListener("visibilitychange", onVisible);
  const interval = window.setInterval(() => {
    if (state.pending > 0) void run();
  }, 30_000);

  void refreshPending().then(() => void run());

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(interval);
    started = false;
  };
}

export async function syncNow() {
  return flushOutbox();
}
