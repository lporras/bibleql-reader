import { useQuery } from "@tanstack/react-query";
import { fetchOllamaStatus, type OllamaStatus } from "../lib/ollama";
import { queryKeys } from "./keys";

export function useOllamaStatus(enabled: boolean): OllamaStatus | null | undefined {
  const query = useQuery({
    queryKey: queryKeys.ollamaStatus(),
    queryFn: fetchOllamaStatus,
    enabled,
    networkMode: "always",
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: false
  });
  return query.data;
}
