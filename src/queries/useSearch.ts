import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { gqlRequest, HAS_BIBLEQL_KEY } from "../lib/graphql";
import { offlineBible } from "../platform/offline";
import { queryKeys } from "./keys";
import { remoteFirst, useOfflineSource } from "./useOfflineInstalled";
import type { SearchHit } from "../types/bible";

interface SearchResponse {
  search: SearchHit[];
}

const LIMIT = 40;

const QUERY =
  `query($t:String!,$q:String!){ search(translation:$t, query:$q, limit:${LIMIT}){ bookName chapter verse text } }`;

async function fetchSearch(translationId: string, query: string): Promise<SearchHit[]> {
  const data = await gqlRequest<SearchResponse>(QUERY, { t: translationId, q: query });
  return data.search ?? [];
}

export function useSearch(translationId: string, query: string, enabled: boolean): UseQueryResult<SearchHit[]> {
  const offline = useOfflineSource(translationId);
  return useQuery({
    queryKey: queryKeys.search(translationId, query),
    queryFn: () =>
      remoteFirst(
        offline.isLocalNow(),
        () => fetchSearch(translationId, query),
        () => offlineBible.search(translationId, query, LIMIT)
      ),
    networkMode: offline.networkMode,
    enabled: enabled && offline.ready && (offline.local || HAS_BIBLEQL_KEY) && !!query,
    retry: false
  });
}
