/** Server state — TanStack Query. The poll cadence mirrors desktop codenotch:
 * a reading a minute, paused while the app is in the background and caught
 * up the moment it returns (see the focus wiring in the root layout). Pull to
 * refresh and Refresh now force it sooner. */
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useConnection } from "./connection";
import { fetchSnapshot, refreshSnapshot, type ConnectionConfig } from "../lib/api";
import { haptic } from "../lib/haptics";

function snapshotKey(config: ConnectionConfig | null) {
  return ["snapshot", config?.host ?? "", config?.port ?? 0] as const;
}

/** Read the first snapshot ahead of landing on it, so the screen after
 * pairing arrives with its readings instead of a skeleton. */
export function prefetchSnapshot(client: QueryClient, config: ConnectionConfig): Promise<void> {
  return client.prefetchQuery({ queryKey: snapshotKey(config), queryFn: () => fetchSnapshot(config), staleTime: 30_000 });
}

export function useSnapshot() {
  const { config, status, updateConfig } = useConnection();
  return useQuery({
    queryKey: snapshotKey(config),
    queryFn: () => fetchSnapshot(config!, updateConfig),
    enabled: status === "paired" && !!config,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    retry: (failureCount) => failureCount < 1,
  });
}

export function useRefreshNow() {
  const { config, updateConfig } = useConnection();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!config) throw new Error("not paired");
      return await refreshSnapshot(config, updateConfig);
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
 * spinner in and shove the list down once a minute. A pull that fails says
 * so in the hand at once; `unreachable` then holds while the readings on
 * screen are the last good ones — the Mac missed the pull or the poll, and
 * nothing has landed since. */
export function usePullToRefresh() {
  const refreshNow = useRefreshNow();
  const query = useSnapshot();
  const pullFailed = refreshNow.isError && query.dataUpdatedAt < refreshNow.submittedAt;
  return {
    refreshing: refreshNow.isPending,
    onRefresh: () => refreshNow.mutate(undefined, { onError: () => haptic.error() }),
    unreachable: !!query.data && !refreshNow.isPending && (query.isError || pullFailed),
    lastReadingAt: query.dataUpdatedAt,
    retrying: query.isFetching,
    retry: () => {
      query.refetch().catch(() => {});
    },
  };
}
