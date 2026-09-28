import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { gqlRequest, HAS_BIBLEQL_KEY } from "../lib/graphql";
import { queryKeys } from "./keys";
import type { SearchHit } from "../types/bible";

interface SearchResponse {
  search: SearchHit[];
}

const QUERY =
  "query($t:String!,$q:String!){ search(translation:$t, query:$q, limit:40){ bookName chapter verse text } }";

async function fetchSearch(translationId: string, query: string): Promise<SearchHit[]> {
  const data = await gqlRequest<SearchResponse>(QUERY, { t: translationId, q: query });
  return data.search ?? [];
}

export function useSearch(translationId: string, query: string, enabled: boolean): UseQueryResult<SearchHit[]> {
  return useQuery({
    queryKey: queryKeys.search(translationId, query),
    queryFn: () => fetchSearch(translationId, query),
    enabled: enabled && HAS_BIBLEQL_KEY && !!query,
    retry: false
  });
}
