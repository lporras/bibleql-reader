import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { gqlRequest, HAS_BIBLEQL_KEY } from "../lib/graphql";
import { offlineBible } from "../platform/offline";
import { queryKeys } from "./keys";
import { OFFLINE_SCHEMA_VERSION, type OfflineAvailability } from "../types/offline";

interface AvailabilityResponse {
  translations: OfflineAvailability[];
}

const QUERY =
  "query($v:Int){ translations { identifier offlineDownloadable offlinePackage(schemaVersion:$v){ url sha256 sizeBytes updatedAt } } }";

async function fetchAvailability(): Promise<OfflineAvailability[]> {
  const data = await gqlRequest<AvailabilityResponse>(QUERY, { v: OFFLINE_SCHEMA_VERSION });
  return data.translations ?? [];
}

// Which translations BibleQL publishes as offline packages, and the current
// package of each — a different sha256 than the installed one means an
// update. Only asked inside a shell, since only the shell can download.
export function useOfflineAvailability(): ReadonlyMap<string, OfflineAvailability> {
  const { data } = useQuery({
    queryKey: queryKeys.offlineAvailability(),
    queryFn: fetchAvailability,
    enabled: HAS_BIBLEQL_KEY && offlineBible.canDownload(),
    staleTime: 30 * 60_000,
    retry: false
  });
  return useMemo(() => new Map((data ?? []).map((t) => [t.identifier, t])), [data]);
}
