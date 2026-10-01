import { useMemo } from "react";
import { onlineManager, useQuery, useQueryClient } from "@tanstack/react-query";
import { HAS_BIBLEQL_KEY } from "../lib/graphql";
import { offlineBible } from "../platform/offline";
import { queryKeys } from "./keys";
import type { InstalledTranslation } from "../types/offline";

export interface OfflineInstalled {
  installed: InstalledTranslation[];
  byId: ReadonlyMap<string, InstalledTranslation>;
  /** False until the first list comes back — passage/search wait on it so
   * an installed translation never makes a stray network request. */
  ready: boolean;
}

// Translations downloaded for offline use. Once installed, a translation is
// always read locally for chapters; search and concordance use it when
// BibleQL can't be reached (see remoteFirst below).
export function useOfflineInstalled(): OfflineInstalled {
  const query = useQuery({
    queryKey: queryKeys.offlineInstalled(),
    queryFn: () => offlineBible.list(),
    // A local call: never pause it for the network (see OfflineSource).
    networkMode: "always",
    staleTime: Infinity,
    retry: false
  });
  const data = query.data;
  const byId = useMemo(() => new Map((data ?? []).map((t) => [t.identifier, t])), [data]);
  return { installed: data ?? [], byId, ready: query.isFetched };
}

export interface OfflineSource {
  ready: boolean;
  /** For `enabled` — whether this render sees the translation installed. */
  local: boolean;
  /** For `queryFn` — checks the cache at fetch time, so a refetch fired by
   * installing or removing (before this hook re-renders) takes the new path. */
  isLocalNow(): boolean;
  /** TanStack pauses "online"-mode queries while the OS reports no
   * network — with Wi-Fi off a local read would never run, and
   * keepPreviousData would keep showing the last chapter. Local reads run
   * regardless. */
  networkMode: "always" | "online";
}

export function useOfflineSource(translationId: string): OfflineSource {
  const queryClient = useQueryClient();
  const offline = useOfflineInstalled();
  return {
    ready: offline.ready,
    local: offline.byId.has(translationId),
    networkMode: offline.byId.has(translationId) ? "always" : "online",
    isLocalNow: () =>
      (queryClient.getQueryData<InstalledTranslation[]>(queryKeys.offlineInstalled()) ?? []).some(
        (t) => t.identifier === translationId
      )
  };
}

function networkAvailable(): boolean {
  return HAS_BIBLEQL_KEY && onlineManager.isOnline() && (typeof navigator === "undefined" || navigator.onLine);
}

// Search and concordance prefer BibleQL whenever it's reachable, even for a
// downloaded translation, and use the local copy when offline — or when the
// request fails (Wi-Fi without internet, a translation the server has no
// concordance index for). Chapter reading doesn't use this: it is always
// local once downloaded.
export async function remoteFirst<T>(
  installed: boolean,
  remote: () => Promise<T>,
  local: () => Promise<T>
): Promise<T> {
  if (!installed) return remote();
  if (!networkAvailable()) return local();
  try {
    return await remote();
  } catch {
    return local();
  }
}
