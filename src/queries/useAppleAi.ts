import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useAppState } from "../state/AppStateContext";
import { appleAi } from "../platform/appleai";
import { APPLE_AI_SUPPORTED } from "../platform/host";
import type { AppleAiStatus } from "../types/ai";
import { queryKeys } from "./keys";

/** Whether Apple Intelligence can answer in the app's language. */
export function useAppleAiStatus(): UseQueryResult<AppleAiStatus> {
  const { state } = useAppState();
  return useQuery({
    queryKey: queryKeys.appleAiStatus(state.locale),
    queryFn: () => appleAi.availability(state.locale),
    enabled: APPLE_AI_SUPPORTED,
    // A local call: never pause it for the network.
    networkMode: "always",
    // It changes outside the app (the model finishes downloading, Apple
    // Intelligence is switched on in Settings), so look again on coming back.
    staleTime: 0,
    refetchOnWindowFocus: "always",
    retry: false
  });
}
