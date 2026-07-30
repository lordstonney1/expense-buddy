import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PieChart } from "lucide-react";
import { fetchExpenses } from "@/lib/offline-sync";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/reports")({
  component: Reports,
});

type Row = { amount: number; category: string; spent_on: string };

const CATS: Record<string, { label: string; emoji: string }> = {
  food: { label: "Food", emoji: "🍲" },
  transport: { label: "Transport", emoji: "🚌" },
  books: { label: "Books", emoji: "📚" },
  accommodation: { label: "Accommodation", emoji: "🏠" },
  entertainment: { label: "Entertainment", emoji: "🎬" },
  utilities: { label: "Utilities", emoji: "💡" },
  health: { label: "Health", emoji: "💊" },
  other: { label: "Other", emoji: "🧾" },
};

function fmtGHC(n: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(n);
}

function Reports() {
  const { user } = Route.useRouteContext();
  const thisMonth = new Date().toISOString().slice(0, 7);

  const q = useQuery({
    queryKey: ["reports", user.id, thisMonth],
    queryFn: async () => {
      const all = await fetchExpenses(user.id);
      return all.filter((r) => r.spent_on >= `${thisMonth}-01`) as Row[];
    },
  });

  const rows = q.data ?? [];
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const byCat = new Map<string, number>();
  for (const r of rows) {
    byCat.set(r.category, (byCat.get(r.category) ?? 0) + Number(r.amount));
  }
  const breakdown = Array.from(byCat.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-5">
          <PieChart className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">Reports</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">This month</p>
          <p className="mt-1 font-display text-3xl font-bold text-foreground">{fmtGHC(total)}</p>
        </div>

        <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          By category
        </h2>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : breakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No expenses yet this month. Add some from the Home tab.
          </p>
        ) : (
          <ul className="space-y-2">
            {breakdown.map(({ category, amount }) => {
              const meta = CATS[category] ?? { label: category, emoji: "•" };
              const pct = total > 0 ? (amount / total) * 100 : 0;
              return (
                <li key={category} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      <span className="mr-2">{meta.emoji}</span>
                      {meta.label}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{fmtGHC(amount)}</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pct.toFixed(1)}% of monthly spend
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
