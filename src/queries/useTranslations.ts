import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { gqlRequest, HAS_BIBLEQL_KEY } from "../lib/graphql";
import { writeCachedTranslations } from "../state/persist";
import { queryKeys } from "./keys";
import type { TranslationSummary } from "../types/bible";

interface TranslationsResponse {
  translations: TranslationSummary[];
}

const QUERY = "query { translations { identifier name language note concordanceIndexedAt } }";

async function fetchTranslations(): Promise<TranslationSummary[]> {
  const data = await gqlRequest<TranslationsResponse>(QUERY);
  const list = (data.translations || []).slice().sort((a, b) => a.identifier.localeCompare(b.identifier));
  if (list.length) writeCachedTranslations(list);
  return list;
}

export function useTranslations(): UseQueryResult<TranslationSummary[]> {
  return useQuery({
    queryKey: queryKeys.translations(),
    queryFn: fetchTranslations,
    enabled: HAS_BIBLEQL_KEY,
    staleTime: Infinity,
    // The original silently swallows a failed fetch and keeps the fallback list.
    retry: false
  });
}
