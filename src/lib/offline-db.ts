import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type OfflineExpense = {
  id: string;
  user_id: string;
  amount: number;
  category: string;
  description: string | null;
  spent_on: string;
  created_at: string;
  receipt_path: string | null;
  /** true while a local change for this row is still waiting to reach the server */
  _pending?: boolean;
};

export type OutboxOp = "insert" | "update" | "delete";

export type OutboxEntry = {
  key: string;
  expenseId: string;
  userId: string;
  op: OutboxOp;
  /** partial row for insert/update */
  payload: Record<string, unknown>;
  receiptBlob?: Blob;
  receiptType?: string;
  receiptName?: string;
  /** for delete / receipt replacement cleanup */
  removeReceiptPath?: string | null;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
};

interface CediDB extends DBSchema {
  expenses: {
    key: string;
    value: OfflineExpense;
    indexes: { by_user: string };
  };
  outbox: {
    key: string;
    value: OutboxEntry;
    indexes: { by_created: number };
  };
}

let dbPromise: Promise<IDBPDatabase<CediDB>> | null = null;

function getDB() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB<CediDB>("ceditrack-offline", 1, {
      upgrade(db) {
        const exp = db.createObjectStore("expenses", { keyPath: "id" });
        exp.createIndex("by_user", "user_id");
        const out = db.createObjectStore("outbox", { keyPath: "key" });
        out.createIndex("by_created", "createdAt");
      },
    });
  }
  return dbPromise;
}

export async function localExpenses(userId: string): Promise<OfflineExpense[]> {
  const db = await getDB();
  if (!db) return [];
  const rows = await db.getAllFromIndex("expenses", "by_user", userId);
  return rows.sort(
    (a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at),
  );
}

export async function putLocalExpense(row: OfflineExpense) {
  const db = await getDB();
  if (!db) return;
  await db.put("expenses", row);
}

export async function getLocalExpense(id: string) {
  const db = await getDB();
  if (!db) return undefined;
  return db.get("expenses", id);
}

export async function deleteLocalExpense(id: string) {
  const db = await getDB();
  if (!db) return;
  await db.delete("expenses", id);
}

/**
 * Replace the cached server snapshot for a user while preserving any rows that
 * still have unsynced local changes.
 */
export async function replaceServerSnapshot(
  userId: string,
  serverRows: OfflineExpense[],
  pendingIds: Set<string>,
) {
  const db = await getDB();
  if (!db) return;
  const tx = db.transaction("expenses", "readwrite");
  const store = tx.objectStore("expenses");
  const existing = await store.index("by_user").getAllKeys(userId);
  for (const key of existing) {
    if (!pendingIds.has(String(key))) await store.delete(key);
  }
  for (const row of serverRows) {
    if (pendingIds.has(row.id)) continue;
    await store.put({ ...row, user_id: userId, _pending: false });
  }
  await tx.done;
}

export async function addOutbox(entry: OutboxEntry) {
  const db = await getDB();
  if (!db) return;
  await db.put("outbox", entry);
}

export async function allOutbox(): Promise<OutboxEntry[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAllFromIndex("outbox", "by_created");
}

export async function outboxForExpense(expenseId: string) {
  const entries = await allOutbox();
  return entries.filter((e) => e.expenseId === expenseId);
}

export async function deleteOutbox(key: string) {
  const db = await getDB();
  if (!db) return;
  await db.delete("outbox", key);
}

export async function putOutbox(entry: OutboxEntry) {
  const db = await getDB();
  if (!db) return;
  await db.put("outbox", entry);
}

export async function clearAllOffline() {
  const db = await getDB();
  if (!db) return;
  await db.clear("expenses");
  await db.clear("outbox");
}
