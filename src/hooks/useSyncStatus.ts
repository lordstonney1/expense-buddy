import { useEffect, useState } from "react";
import { getSyncState, subscribeSync, type SyncState } from "@/lib/offline-sync";

export function useSyncStatus(): SyncState {
  const [s, setS] = useState<SyncState>(() => getSyncState());

  useEffect(() => {
    setS(getSyncState());
    const unsub = subscribeSync(setS);
    return () => {
      unsub();
    };
  }, []);

  return s;
}
