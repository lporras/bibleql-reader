import { useInfiniteQuery, type InfiniteData, type UseInfiniteQueryResult } from "@tanstack/react-query";
import { gqlRequest, HAS_BIBLEQL_KEY } from "../lib/graphql";
import { offlineBible } from "../platform/offline";
import { queryKeys } from "./keys";
import { remoteFirst, useOfflineSource } from "./useOfflineInstalled";
import type { ConcordanceEntry, ConcordanceHitNode, ConcordancePageResult } from "../types/bible";

const PAGE_SIZE = 25;

// Local cursors are canonical verse ids; this prefix tells "Load more" to
// stay on the source the first page came from — a server cursor means
// nothing to the local index, and vice versa.
const LOCAL_CURSOR = "local:";

interface ConcordanceResponse {
  concordance: {
    totalCount: number;
    entry: ConcordanceEntry | null;
    edges: { node: ConcordanceHitNode }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

const QUERY =
  `query($t:String!,$w:String!,$a:String){ concordance(translation:$t, word:$w, first:${PAGE_SIZE}, after:$a){ totalCount entry { surfaceForms totalOccurrences verseCount occurrencesByTestament { old new } } edges { node { context verse { bookName chapter verse } } } pageInfo { hasNextPage endCursor } } }`;

async function fetchConcordancePage(
  translationId: string,
  word: string,
  after: string | null
): Promise<ConcordancePageResult> {
  const data = await gqlRequest<ConcordanceResponse>(QUERY, { t: translationId, w: word, a: after });
  const c = data.concordance;
  return {
    totalCount: c.totalCount,
    entry: c.entry,
    hits: (c.edges || []).map((edge) => edge.node),
    pageInfo: c.pageInfo ?? { hasNextPage: false, endCursor: null }
  };
}

async function fetchLocalPage(translationId: string, word: string, after: string | null): Promise<ConcordancePageResult> {
  const page = await offlineBible.concordance(translationId, word, PAGE_SIZE, after);
  const endCursor = page.pageInfo.endCursor;
  return { ...page, pageInfo: { ...page.pageInfo, endCursor: endCursor && LOCAL_CURSOR + endCursor } };
}

export function useConcordance(
  translationId: string,
  word: string,
  enabled: boolean
): UseInfiniteQueryResult<InfiniteData<ConcordancePageResult>> {
  const offline = useOfflineSource(translationId);
  return useInfiniteQuery({
    queryKey: queryKeys.concordance(translationId, word),
    queryFn: ({ pageParam }) => {
      if (pageParam?.startsWith(LOCAL_CURSOR)) {
        return fetchLocalPage(translationId, word, pageParam.slice(LOCAL_CURSOR.length));
      }
      if (pageParam) return fetchConcordancePage(translationId, word, pageParam);
      return remoteFirst(
        offline.isLocalNow(),
        () => fetchConcordancePage(translationId, word, null),
        () => fetchLocalPage(translationId, word, null)
      );
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.pageInfo.hasNextPage ? last.pageInfo.endCursor : undefined),
    networkMode: offline.networkMode,
    enabled: enabled && offline.ready && (offline.local || HAS_BIBLEQL_KEY) && !!word,
    retry: false
  });
}
