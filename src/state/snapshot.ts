/** Server state — TanStack Query. The poll cadence mirrors desktop codenotch:
 * a reading a minute. Pull-to-refresh and Refresh now force it sooner. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "./connection";
import { fetchSnapshot, refreshSnapshot } from "../lib/api";

export function useSnapshot() {
  const { config, status } = useConnection();
  return useQuery({
    queryKey: ["snapshot", config?.host ?? "", config?.port ?? 0],
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
      client.setQueryData(["snapshot", config?.host ?? "", config?.port ?? 0], snapshot);
    },
  });
}
