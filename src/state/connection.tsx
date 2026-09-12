/**
 * Connection state — the one broad piece of client state in the app.
 * Everything server-side lives in TanStack Query; this context only carries
 * *whether and where* we are connected.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ConnectionConfig } from "../lib/api";
import { clearConnection, loadConnection, saveConnection } from "../lib/storage";

type Status = "loading" | "paired" | "unpaired";

interface ConnectionValue {
  status: Status;
  config: ConnectionConfig | null;
  repairRequired: boolean;
  pair: (config: ConnectionConfig, serverName?: string) => Promise<void>;
  updateConfig: (config: ConnectionConfig) => Promise<void>;
  disconnect: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionValue | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [config, setConfig] = useState<ConnectionConfig | null>(null);
  const [repairRequired, setRepairRequired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadConnection().then((loaded) => {
      if (cancelled) return;
      setRepairRequired(loaded.repairRequired);
      if (loaded.config) {
        setConfig(loaded.config);
        setStatus("paired");
      } else {
        setStatus("unpaired");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const pair = useCallback(async (next: ConnectionConfig, serverName?: string) => {
    const withName = { ...next, serverName: serverName ?? next.serverName };
    await saveConnection(withName);
    setRepairRequired(false);
    setConfig(withName);
    setStatus("paired");
  }, []);

  const updateConfig = useCallback(async (next: ConnectionConfig) => {
    await saveConnection(next);
    setConfig(next);
  }, []);

  const disconnect = useCallback(async () => {
    await clearConnection();
    setConfig(null);
    setStatus("unpaired");
    // Forget the old Mac's readings, so re-pairing never flashes them.
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(
    () => ({ status, config, repairRequired, pair, updateConfig, disconnect }),
    [status, config, repairRequired, pair, updateConfig, disconnect],
  );
  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection(): ConnectionValue {
  const value = useContext(ConnectionContext);
  if (!value) throw new Error("useConnection outside ConnectionProvider");
  return value;
}
