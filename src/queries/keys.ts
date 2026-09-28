export const queryKeys = {
  translations: () => ["translations"] as const,
  passage: (translationId: string, bookId: string, chapter: number) =>
    ["passage", translationId, bookId, chapter] as const,
  concordanceSupport: (translationId: string) => ["concordance-support", translationId] as const,
  concordance: (translationId: string, word: string) => ["concordance", translationId, word] as const,
  search: (translationId: string, query: string) => ["search", translationId, query] as const
};
