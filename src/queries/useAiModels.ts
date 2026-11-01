import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useAppState } from "../state/AppStateContext";
import { chatgpt } from "../platform/chatgpt";
import { CHATGPT_SUPPORTED } from "../platform/host";
import { effectiveProvider, pickChatgptModel, resolveChoice } from "../lib/aiModels";
import type { AiModelChoice, AiProvider, ChatgptModel } from "../types/ai";
import { useChatgptAccount } from "./useChatgptAccount";
import { queryKeys } from "./keys";

export interface AiChoiceState {
  /** Who answers. Can differ from the saved preference; see effectiveProvider. */
  provider: AiProvider;
  hasKey: boolean;
  /** Signed in to ChatGPT with plan usage allowed. */
  chatgptReady: boolean;
  /** The account's models, per account because each can see different ones. */
  models: UseQueryResult<ChatgptModel[]>;
  /** The selected or preselected model; null if it's gone or none are listed. */
  chatgptModel: ChatgptModel | null;
  /** What can answer right now; null if the reader has something to do first. */
  choice: AiModelChoice | null;
}

export function useAiChoice(): AiChoiceState {
  const { state } = useAppState();
  const account = useChatgptAccount().data?.account;
  const chatgptReady = !!account?.planEnabled;
  const hasKey = !!state.aiApiKey.trim();
  const models = useQuery({
    queryKey: queryKeys.chatgptModels(account?.sub ?? ""),
    queryFn: () => chatgpt.models(),
    enabled: CHATGPT_SUPPORTED && chatgptReady,
    // Must report back with the network down rather than sit paused.
    networkMode: "always",
    staleTime: Infinity,
    retry: false
  });
  const provider = effectiveProvider(state.aiProvider, hasKey, chatgptReady, CHATGPT_SUPPORTED);
  const chatgptModel = pickChatgptModel(models.data ?? [], state.aiModels.chatgpt);
  return {
    provider,
    hasKey,
    chatgptReady,
    models,
    chatgptModel,
    choice: resolveChoice(provider, hasKey, chatgptReady, chatgptModel)
  };
}
