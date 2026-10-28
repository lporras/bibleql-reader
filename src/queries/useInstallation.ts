import { useQuery } from "@tanstack/react-query";
import { ensureInstallToken } from "../lib/graphql";
import { queryKeys } from "./keys";

export interface InstallationStatus {
  /** This installation has a BibleQL token — remote queries can run. */
  ready: boolean;
  /** Still registering (first launch) or reading the stored token. */
  pending: boolean;
  /** Registration failed (offline, rate limited); retried in the background. */
  failed: boolean;
}

const RETRY_LATER_MS = 60_000;

// The per-installation token as server state: the first launch registers
// with BibleQL here, and every remote query waits on `ready`. The data is a
// flag, never the token itself, so it doesn't sit in the query cache.
// A failed registration keeps the app usable (the reader shows its bundled
// sample) and is retried on reconnect and every minute until it succeeds.
export function useInstallation(): InstallationStatus {
  const query = useQuery({
    queryKey: queryKeys.installation(),
    queryFn: async () => {
      await ensureInstallToken();
      return true;
    },
    // A token read is local, and registering offline should fail fast
    // rather than wait paused for a network TanStack thinks is gone.
    networkMode: "always",
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
    refetchOnReconnect: (q) => q.state.status === "error",
    refetchOnWindowFocus: false,
    refetchInterval: (q) => (q.state.status === "error" ? RETRY_LATER_MS : false)
  });
  return { ready: query.isSuccess, pending: query.isPending, failed: query.isError };
}
