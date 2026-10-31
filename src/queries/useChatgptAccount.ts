import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { chatgpt, type ChatgptStatus } from "../platform/chatgpt";
import { CHATGPT_SUPPORTED } from "../platform/host";
import { queryKeys } from "./keys";

export function useChatgptAccount(): UseQueryResult<ChatgptStatus> {
  return useQuery({
    queryKey: queryKeys.chatgptAccount(),
    queryFn: () => chatgpt.status(),
    enabled: CHATGPT_SUPPORTED,
    // A local call: never pause it for the network.
    networkMode: "always",
    staleTime: Infinity,
    retry: false
  });
}
