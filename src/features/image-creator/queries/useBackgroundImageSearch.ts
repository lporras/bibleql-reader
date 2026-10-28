import { useInfiniteQuery } from "@tanstack/react-query";
import { useInstallation } from "../../../queries/useInstallation";
import { bibleqlImageProvider } from "../providers/BibleQLImageProvider";

/**
 * Paginated background search ("Load more" grows the same result list) —
 * scoped to the feature rather than the app-wide queries/keys.ts, which
 * holds the reader's BibleQL queries.
 */
export function useBackgroundImageSearch(query: string) {
  const installation = useInstallation();
  const trimmed = query.trim();
  return useInfiniteQuery({
    queryKey: ["background-images", trimmed],
    queryFn: ({ pageParam }) => bibleqlImageProvider.search(trimmed, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    enabled: installation.ready && trimmed.length > 0,
    staleTime: 5 * 60_000,
    // A rate limit or an Unsplash outage won't clear up within TanStack's
    // retry window; say so straight away.
    retry: false,
    select: (data) => data.pages
  });
}
