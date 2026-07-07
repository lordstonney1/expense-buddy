import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LogOut, Plus, Trash2, Wallet } from "lucide-react";
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
};

function fmtGHC(n: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(n);
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
        .select("id, amount, category, description, spent_on, created_at")
        .order("spent_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
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
  const totalMonth = expenses
    .filter((e) => e.spent_on.startsWith(thisMonth))
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalAll = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("food");
  const [description, setDescription] = useState("");
  const [spentOn, setSpentOn] = useState(today);

  const addM = useMutation({
    mutationFn: async () => {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) throw new Error("Enter a valid amount");
      const { error } = await supabase.from("expenses").insert({
        user_id: user.id,
        amount: n,
        category,
        description: description.trim() || null,
        spent_on: spentOn,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense added");
      setAmount("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["expenses", user.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const delM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["expenses", user.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
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
            <label className="sm:col-span-5">
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
            <button
              type="submit"
              disabled={addM.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60 sm:col-span-1"
            >
              <Plus className="h-4 w-4" />
              Add
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
                      <button
                        onClick={() => delM.mutate(e.id)}
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
    <div
      className={`rounded-2xl bg-gradient-to-br ${toneClass} p-5 shadow-sm`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-2 font-display text-2xl font-extrabold">{value}</p>
    </div>
  );
}
