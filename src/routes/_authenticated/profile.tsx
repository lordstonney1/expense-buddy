import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut, RefreshCw, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { syncNow } from "@/lib/offline-sync";
import { useSyncStatus } from "@/hooks/useSyncStatus";

export const Route = createFileRoute("/_authenticated/profile")({
  component: Profile,
});

function Profile() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sync = useSyncStatus();

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

  const [fullName, setFullName] = useState("");
  const [school, setSchool] = useState("");

  useEffect(() => {
    if (profileQ.data) {
      setFullName(profileQ.data.full_name ?? "");
      setSchool(profileQ.data.school ?? "");
    }
  }, [profileQ.data]);

  const saveM = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() || null, school: school.trim() || null })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-5">
          <User className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">Profile</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Signed in as
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{user.email}</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveM.mutate();
          }}
          className="space-y-4 rounded-2xl border border-border bg-card p-6"
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-foreground">
              Full name
            </span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              placeholder="Ama Mensah"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-foreground">School</span>
            <input
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              placeholder="University of Ghana"
            />
          </label>
          <button
            type="submit"
            disabled={saveM.isPending}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            {saveM.isPending ? "Saving…" : "Save changes"}
          </button>
        </form>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Offline sync</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {!sync.online
                  ? "You're offline. Expenses are saved on this device."
                  : sync.pending > 0
                    ? `${sync.pending} change${sync.pending === 1 ? "" : "s"} waiting to upload.`
                    : "Everything is synced."}
                {sync.lastSyncedAt
                  ? ` Last synced ${new Date(sync.lastSyncedAt).toLocaleString("en-GB")}.`
                  : ""}
              </p>
            </div>
            <button
              onClick={async () => {
                const { synced } = await syncNow();
                await qc.invalidateQueries({ queryKey: ["expenses", user.id] });
                await qc.invalidateQueries({ queryKey: ["reports", user.id] });
                toast.success(
                  synced > 0 ? `Synced ${synced} change${synced === 1 ? "" : "s"}` : "Up to date",
                );
              }}
              disabled={sync.syncing || !sync.online}
              className="inline-flex flex-none items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${sync.syncing ? "animate-spin" : ""}`} />
              Sync now
            </button>
          </div>
        </div>



        <button
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </main>

      <BottomNav />
    </div>
  );
}
