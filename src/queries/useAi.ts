import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useAppState } from "../state/AppStateContext";
import { askAi, ChatgptRequestError } from "../lib/ai";
import { STR } from "../data/strings";
import type { AiAnswer } from "../types/ai";
import { useAiChoice } from "./useAiModels";
import { queryKeys } from "./keys";

export interface AiQuestion {
  question: string;
  /** Title of the study being prepared, when asked from the study page. */
  studyTitle?: string;
  /** Called with the answer-so-far as the reply streams in. */
  onPartial?: (answer: AiAnswer) => void;
}

export function useAi(): UseMutationResult<AiAnswer, Error, AiQuestion> {
  const { state } = useAppState();
  const { choice } = useAiChoice();
  const queryClient = useQueryClient();
  return useMutation({
    // ChatGPT answers through Rust, which reports back even with the network down.
    networkMode: "always",
    mutationFn: ({ question, studyTitle, onPartial }: AiQuestion) => {
      if (!choice) throw new Error(STR[state.locale].aiChooseFirst);
      return askAi({
        question,
        locale: state.locale,
        choice,
        // ChatGPT's tokens stay in Rust, so only Claude's key is passed along.
        credential: choice.provider === "anthropic" ? state.aiApiKey : undefined,
        studyTitle,
        onPartial
      });
    },
    onError: (error) => {
      if (!(error instanceof ChatgptRequestError)) return;
      // The sign-in ended or changed: let everything showing it catch up.
      if (error.code === "reauth_required" || error.code === "plan_disabled") {
        void queryClient.invalidateQueries({ queryKey: queryKeys.chatgptAccount() });
      }
      // The list may have changed. If the model is gone, the select asks for another.
      if (error.param === "model") void queryClient.invalidateQueries({ queryKey: ["chatgpt", "models"] });
    }
  });
}
