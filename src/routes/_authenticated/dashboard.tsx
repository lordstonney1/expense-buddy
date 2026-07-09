import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  LogOut,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Category =
  | "food"
  | "transport"
  | "books"
  | "accommodation"
  | "entertainment"
  | "utilities"
  | "health"
  | "other";

const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: "food", label: "Food", emoji: "🍲" },
  { value: "transport", label: "Transport", emoji: "🚌" },
  { value: "books", label: "Books", emoji: "📚" },
  { value: "accommodation", label: "Accommodation", emoji: "🏠" },
  { value: "entertainment", label: "Entertainment", emoji: "🎬" },
  { value: "utilities", label: "Utilities", emoji: "💡" },
  { value: "health", label: "Health", emoji: "💊" },
  { value: "other", label: "Other", emoji: "🧾" },
];

type Expense = {
  id: string;
  amount: number;
  category: Category;
  description: string | null;
  spent_on: string;
  created_at: string;
  receipt_path: string | null;
};

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5 MB

function fmtGHC(n: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(n);
}

function csvEscape(v: string | number | null) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function extFor(file: File) {
  const fromName = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase()
    : "";
  if (fromName) return fromName;
  const fromType = file.type.split("/")[1];
  return fromType || "bin";
}

async function uploadReceipt(userId: string, expenseId: string, file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Receipt must be an image");
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    throw new Error("Receipt must be under 5 MB");
  }
  const path = `${userId}/${expenseId}-${Date.now()}.${extFor(file)}`;
  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}

async function openReceipt(path: string) {
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(path, 60);
  if (error || !data) {
    toast.error(error?.message ?? "Could not open receipt");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener");
}

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const profileQ = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, school")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const expensesQ = useQuery({
    queryKey: ["expenses", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(
          "id, amount, category, description, spent_on, created_at, receipt_path",
        )
        .order("spent_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });

  const expenses = expensesQ.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const totalToday = expenses
    .filter((e) => e.spent_on === today)
    .reduce((s, e) => s + Number(e.amount), 0);
  const monthExpenses = expenses.filter((e) => e.spent_on.startsWith(thisMonth));
  const totalMonth = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalAll = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("food");
  const [description, setDescription] = useState("");
  const [spentOn, setSpentOn] = useState(today);
  const [receipt, setReceipt] = useState<File | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const addM = useMutation({
    mutationFn: async () => {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) throw new Error("Enter a valid amount");
      const { data: inserted, error } = await supabase
        .from("expenses")
        .insert({
          user_id: user.id,
          amount: n,
          category,
          description: description.trim() || null,
          spent_on: spentOn,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (receipt && inserted) {
        try {
          const path = await uploadReceipt(user.id, inserted.id, receipt);
          const { error: updErr } = await supabase
            .from("expenses")
            .update({ receipt_path: path })
            .eq("id", inserted.id);
          if (updErr) throw updErr;
        } catch (err) {
          toast.error(
            `Expense saved, but receipt failed: ${
              err instanceof Error ? err.message : "unknown error"
            }`,
          );
        }
      }
    },
    onSuccess: () => {
      toast.success("Expense added");
      setAmount("");
      setDescription("");
      setReceipt(null);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["expenses", user.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const delM = useMutation({
    mutationFn: async (exp: Expense) => {
      if (exp.receipt_path) {
        await supabase.storage.from("receipts").remove([exp.receipt_path]);
      }
      const { error } = await supabase.from("expenses").delete().eq("id", exp.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["expenses", user.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [editing, setEditing] = useState<Expense | null>(null);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function exportMonthCSV() {
    if (monthExpenses.length === 0) {
      toast.info("No expenses this month to export.");
      return;
    }
    const rows = [
      ["Date", "Category", "Description", "Amount (GHS)"],
      ...monthExpenses
        .slice()
        .sort((a, b) => a.spent_on.localeCompare(b.spent_on))
        .map((e) => [
          e.spent_on,
          e.category,
          e.description ?? "",
          Number(e.amount).toFixed(2),
        ]),
      ["", "", "Total", totalMonth.toFixed(2)],
    ];
    const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ceditrack-${thisMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  }

  function confirmDelete(exp: Expense) {
    if (window.confirm("Delete this expense? This cannot be undone.")) {
      delM.mutate(exp);
    }
  }

  const firstName =
    (profileQ.data?.full_name ?? "").split(" ")[0] || user.email?.split("@")[0] || "there";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-display text-lg font-bold text-primary">
            <Wallet className="h-5 w-5" />
            CediTrack
          </div>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-foreground">
              Hi {firstName} 👋
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {profileQ.data?.school
                ? `Tracking expenses at ${profileQ.data.school}.`
                : "Here's your spending today."}
            </p>
          </div>
          <button
            onClick={exportMonthCSV}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-secondary"
          >
            <Download className="h-4 w-4" />
            Export this month (CSV)
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Today" value={fmtGHC(totalToday)} tone="primary" />
          <Stat label="This month" value={fmtGHC(totalMonth)} tone="accent" />
          <Stat label="All time" value={fmtGHC(totalAll)} tone="muted" />
        </div>

        <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold text-foreground">Add expense</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addM.mutate();
            }}
            className="mt-4 grid gap-3 sm:grid-cols-6"
          >
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Amount (GHC)
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Category
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Date
              </span>
              <input
                type="date"
                required
                value={spentOn}
                max={today}
                onChange={(e) => setSpentOn(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <label className="sm:col-span-3">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Note (optional)
              </span>
              <input
                type="text"
                maxLength={140}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Lunch at cafeteria"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Receipt (optional)
              </span>
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > MAX_RECEIPT_BYTES) {
                    toast.error("Receipt must be under 5 MB");
                    e.target.value = "";
                    setReceipt(null);
                    return;
                  }
                  setReceipt(f);
                }}
                className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-xs file:font-medium file:text-foreground hover:file:bg-secondary/80"
              />
            </label>
            <button
              type="submit"
              disabled={addM.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60 sm:col-span-1"
            >
              <Plus className="h-4 w-4" />
              {addM.isPending ? "Saving…" : "Add"}
            </button>
          </form>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-lg font-bold text-foreground">Recent expenses</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {expensesQ.isLoading ? (
              <p className="p-6 text-sm text-muted-foreground">Loading…</p>
            ) : expenses.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                No expenses yet. Add your first one above.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {expenses.map((e) => {
                  const cat = CATEGORIES.find((c) => c.value === e.category)!;
                  return (
                    <li key={e.id} className="flex items-center gap-4 px-5 py-3">
                      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-secondary text-lg">
                        {cat.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {e.description || cat.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {cat.label} · {new Date(e.spent_on).toLocaleDateString("en-GB")}
                        </p>
                      </div>
                      <div className="font-display text-sm font-bold text-foreground">
                        {fmtGHC(Number(e.amount))}
                      </div>
                      {e.receipt_path && (
                        <button
                          onClick={() => openReceipt(e.receipt_path!)}
                          className="rounded-md p-2 text-primary transition hover:bg-primary/10"
                          aria-label="View receipt"
                          title="View receipt"
                        >
                          <Paperclip className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setEditing(e)}
                        className="rounded-md p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                        aria-label="Edit expense"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => confirmDelete(e)}
                        className="rounded-md p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete expense"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </main>

      {editing && (
        <EditExpenseModal
          userId={user.id}
          expense={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["expenses", user.id] });
          }}
        />
      )}
    </div>
  );
}

function EditExpenseModal({
  userId,
  expense,
  onClose,
  onSaved,
}: {
  userId: string;
  expense: Expense;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(String(expense.amount));
  const [category, setCategory] = useState<Category>(expense.category);
  const [description, setDescription] = useState(expense.description ?? "");
  const [spentOn, setSpentOn] = useState(expense.spent_on);
  const [saving, setSaving] = useState(false);
  const [newReceipt, setNewReceipt] = useState<File | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      let receipt_path: string | null | undefined = undefined;

      if (newReceipt) {
        const path = await uploadReceipt(userId, expense.id, newReceipt);
        if (expense.receipt_path && expense.receipt_path !== path) {
          await supabase.storage.from("receipts").remove([expense.receipt_path]);
        }
        receipt_path = path;
      } else if (removeExisting && expense.receipt_path) {
        await supabase.storage.from("receipts").remove([expense.receipt_path]);
        receipt_path = null;
      }

      const update: Record<string, unknown> = {
        amount: n,
        category,
        description: description.trim() || null,
        spent_on: spentOn,
      };
      if (receipt_path !== undefined) update.receipt_path = receipt_path;

      const { error } = await supabase
        .from("expenses")
        .update(update)
        .eq("id", expense.id);
      if (error) throw error;
      toast.success("Expense updated");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const hasExisting = !!expense.receipt_path && !removeExisting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-start justify-between">
          <h3 className="font-display text-lg font-bold text-foreground">Edit expense</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={save} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Amount (GHC)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Category
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Date</span>
            <input
              type="date"
              required
              value={spentOn}
              onChange={(e) => setSpentOn(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Note (optional)
            </span>
            <input
              type="text"
              maxLength={140}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </label>

          <div>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Receipt
            </span>
            {hasExisting && (
              <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <button
                  type="button"
                  onClick={() => openReceipt(expense.receipt_path!)}
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <Paperclip className="h-4 w-4" />
                  View current receipt
                </button>
                <button
                  type="button"
                  onClick={() => setRemoveExisting(true)}
                  className="text-xs text-destructive hover:underline"
                >
                  Remove
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.size > MAX_RECEIPT_BYTES) {
                  toast.error("Receipt must be under 5 MB");
                  e.target.value = "";
                  setNewReceipt(null);
                  return;
                }
                setNewReceipt(f);
              }}
              className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-xs file:font-medium file:text-foreground hover:file:bg-secondary/80"
            />
            {newReceipt && (
              <p className="mt-1 text-xs text-muted-foreground">
                {hasExisting ? "Will replace the current receipt." : "New receipt selected."}
              </p>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "accent" | "muted";
}) {
  const toneClass =
    tone === "primary"
      ? "from-primary to-primary/80 text-primary-foreground"
      : tone === "accent"
        ? "from-accent to-accent/80 text-accent-foreground"
        : "from-secondary to-muted text-foreground";
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${toneClass} p-5 shadow-sm`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-2 font-display text-2xl font-extrabold">{value}</p>
    </div>
  );
}
