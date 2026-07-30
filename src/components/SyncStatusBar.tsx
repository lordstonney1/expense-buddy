import { CheckCircle2, CloudOff, RefreshCw } from "lucide-react";
import { useSyncStatus } from "@/hooks/useSyncStatus";

export function SyncStatusBar() {
  const { online, pending, syncing } = useSyncStatus();

  if (online && pending === 0 && !syncing) return null;

  const label = !online
    ? pending > 0
      ? `Offline — ${pending} change${pending === 1 ? "" : "s"} saved on this device`
      : "Offline — your changes will be saved here"
    : syncing
      ? "Syncing your changes…"
      : `${pending} change${pending === 1 ? "" : "s"} waiting to sync`;

  const Icon = !online ? CloudOff : syncing ? RefreshCw : CheckCircle2;

  return (
    <div
      role="status"
      className={`fixed bottom-16 left-0 right-0 z-40 border-t px-4 py-2 text-center text-xs font-medium ${
        online
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      <span className="inline-flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
        {label}
      </span>
    </div>
  );
}
