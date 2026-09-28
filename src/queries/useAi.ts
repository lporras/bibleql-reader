import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useAppState } from "../state/AppStateContext";
import { askAi } from "../lib/ai";
import type { AiAnswer } from "../types/ai";

export function useAi(): UseMutationResult<AiAnswer, Error, string> {
  const { state } = useAppState();
  return useMutation({
    mutationFn: (question: string) => askAi(question, state.locale, state.aiApiKey)
  });
}
