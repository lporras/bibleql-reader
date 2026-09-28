import { useInfiniteQuery } from "@tanstack/react-query";
import { HAS_UNSPLASH_KEY, unsplashProvider } from "../providers/UnsplashProvider";

/**
 * Paginated Unsplash search ("Load more" grows the same result list) —
 * scoped to the feature rather than the app-wide queries/keys.ts, since
 * that key factory is specifically for BibleQL queries.
 */
export function useUnsplashSearch(query: string) {
  const trimmed = query.trim();
  return useInfiniteQuery({
    queryKey: ["unsplash-search", trimmed],
    queryFn: ({ pageParam }) => unsplashProvider.search(trimmed, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    enabled: HAS_UNSPLASH_KEY && trimmed.length > 0,
    staleTime: 5 * 60_000,
    select: (data) => data.pages
  });
}
