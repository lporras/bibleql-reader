import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { gqlRequest, HAS_BIBLEQL_KEY } from "../lib/graphql";
import { queryKeys } from "./keys";
import { useOfflineInstalled, useOfflineSource } from "./useOfflineInstalled";

interface ConcordanceSupportResponse {
  translation: { concordanceIndexedAt: string | null } | null;
}

const QUERY = "query($i:String!){ translation(identifier:$i){ concordanceIndexedAt } }";

async function fetchConcordanceIndexedAt(translationId: string): Promise<string | null> {
  const data = await gqlRequest<ConcordanceSupportResponse>(QUERY, { i: translationId });
  return data.translation?.concordanceIndexedAt ?? null;
}

// Concordance only answers for translations BibleQL has indexed — checked
// separately from the actual lookup so re-submitting the same word doesn't
// re-check support every time. A downloaded translation is always supported:
// even when the server has no index for it, useConcordance falls back to the
// package's own full-text index.
export function useConcordanceSupport(translationId: string): UseQueryResult<string | null> {
  const offline = useOfflineSource(translationId);
  const installed = useOfflineInstalled().byId.get(translationId);
  return useQuery({
    queryKey: queryKeys.concordanceSupport(translationId),
    queryFn: () =>
      offline.isLocalNow() ? installed?.exportedAt || "offline" : fetchConcordanceIndexedAt(translationId),
    networkMode: offline.networkMode,
    enabled: offline.ready && (offline.local || HAS_BIBLEQL_KEY) && !!translationId,
    staleTime: 10 * 60_000
  });
}
