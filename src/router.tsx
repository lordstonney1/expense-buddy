import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep data around so previously visited pages render instantly offline.
        gcTime: 1000 * 60 * 60 * 24 * 7,
        staleTime: 1000 * 30,
        networkMode: "offlineFirst",
        retry: 1,
      },
      mutations: { networkMode: "offlineFirst" },
    },
  });

  if (typeof window !== "undefined") {
    try {
      persistQueryClient({
        queryClient,
        persister: createSyncStoragePersister({ storage: window.localStorage }),
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
    } catch {
      // storage unavailable (private mode) — offline data still lives in IndexedDB
    }
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
