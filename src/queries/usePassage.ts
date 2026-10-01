import { useQuery, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import { gqlRequest, HAS_BIBLEQL_KEY } from "../lib/graphql";
import { refFor } from "../lib/refs";
import { offlineBible } from "../platform/offline";
import { queryKeys } from "./keys";
import { useOfflineSource } from "./useOfflineInstalled";
import type { PassageResult } from "../types/bible";

interface PassageResponse {
  passage: PassageResult | null;
}

const QUERY =
  "query($t:String!,$r:String!){ passage(translation:$t, reference:$r){ reference translationName translationNote verses { verse text } } }";

async function fetchPassage(translationId: string, reference: string): Promise<PassageResult> {
  const data = await gqlRequest<PassageResponse>(QUERY, { t: translationId, r: reference });
  const p = data.passage;
  return {
    reference: p?.reference ?? reference,
    translationName: p?.translationName ?? translationId,
    translationNote: p?.translationNote ?? "",
    verses: p?.verses ?? []
  };
}

// `slot` isn't part of the cache key — identity is translationId+bookId+chapter,
// so two columns showing the same translation+location correctly share one
// cached fetch. It exists only for callsite clarity:
// usePassage("a", transA, ...) / usePassage("b", transB, ...).
//
// A translation downloaded for offline use is read from its local package
// instead — same result shape, so the cache key doesn't care which source.
export function usePassage(
  slot: "a" | "b",
  translationId: string,
  bookId: string,
  chapter: number,
  enabled: boolean = true
): UseQueryResult<PassageResult> {
  void slot;
  const offline = useOfflineSource(translationId);
  return useQuery({
    queryKey: queryKeys.passage(translationId, bookId, chapter),
    queryFn: () =>
      offline.isLocalNow()
        ? offlineBible.passage(translationId, bookId, chapter)
        : fetchPassage(translationId, refFor(translationId, bookId, chapter)),
    networkMode: offline.networkMode,
    enabled: enabled && offline.ready && (offline.local || HAS_BIBLEQL_KEY) && !!translationId && !!bookId,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData
  });
}
