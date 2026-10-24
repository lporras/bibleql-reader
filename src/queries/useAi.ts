import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useAppState } from "../state/AppStateContext";
import { askAi } from "../lib/ai";
import type { AiAnswer } from "../types/ai";

export interface AiQuestion {
  question: string;
  /** Title of the study being prepared, when asked from the study page. */
  studyTitle?: string;
  /** Called with the answer-so-far as the reply streams in. */
  onPartial?: (answer: AiAnswer) => void;
}

export function useAi(): UseMutationResult<AiAnswer, Error, AiQuestion> {
  const { state } = useAppState();
  return useMutation({
    mutationFn: ({ question, studyTitle, onPartial }: AiQuestion) =>
      askAi(question, state.locale, state.aiApiKey, studyTitle, onPartial)
  });
}
