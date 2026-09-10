/** Server state — TanStack Query. The poll cadence mirrors desktop codenotch:
 * a reading a minute, paused while the app is in the background and caught
 * up the moment it returns (see the focus wiring in the root layout). Pull to
 * refresh and Refresh now force it sooner. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "./connection";
import { fetchSnapshot, refreshSnapshot, type ConnectionConfig } from "../lib/api";

function snapshotKey(config: ConnectionConfig | null) {
  return ["snapshot", config?.host ?? "", config?.port ?? 0] as const;
}

export function useSnapshot() {
  const { config, status } = useConnection();
  return useQuery({
    queryKey: snapshotKey(config),
    queryFn: () => fetchSnapshot(config!),
    enabled: status === "paired" && !!config,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useRefreshNow() {
  const { config } = useConnection();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!config) throw new Error("not paired");
      return await refreshSnapshot(config);
    },
    onSuccess: (snapshot) => {
      client.setQueryData(snapshotKey(config), snapshot);
    },
    // A failed refresh re-asks for the snapshot, so a Mac that went away
    // surfaces as the screen's error state rather than a silent spinner.
    onError: () => {
      client.invalidateQueries({ queryKey: snapshotKey(config) });
    },
  });
}

/** Pull-to-refresh state. `refreshing` is true only for a refresh the user
 * asked for — never for the background poll, which would otherwise drop the
 * spinner in and shove the list down once a minute. */
export function usePullToRefresh() {
  const refreshNow = useRefreshNow();
  return {
    refreshing: refreshNow.isPending,
    onRefresh: () => refreshNow.mutate(),
  };
}
