import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useAppState } from "./AppStateContext";
import { useAi } from "../queries/useAi";
import type { AiReference } from "../types/ai";

export interface ChatMessage {
  /** The question is shown as typed; answers are formatted (components/StudyPanel/AiText). */
  from: "user" | "assistant";
  who: string;
  text: string;
  refs: AiReference[];
}

interface AiChatContextValue {
  messages: ChatMessage[];
  pending: boolean;
  ask(question: string, studyTitle?: string): Promise<void>;
}

// One conversation for the whole app rather than one per AIAssistant
// instance. The assistant appears both in the reader's study panel and on
// the study page, and the workflow moves between them constantly: ask for
// verses while writing, open one in the reader, come back. Owning the
// transcript per instance would wipe it on every one of those hops. Not
// persisted — like before, a chat lasts as long as the window.
const AiChatContext = createContext<AiChatContextValue | null>(null);

export function AiChatProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { state } = useAppState();
  const es = state.locale === "es";
  const ai = useAi();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { isPending, mutateAsync } = ai;

  const ask = useCallback(
    async (question: string, studyTitle?: string) => {
      const q = question.trim();
      if (!q || isPending) return;
      setMessages((prev) => prev.concat([{ from: "user", who: es ? "Tú" : "You", text: q, refs: [] }]));
      try {
        const answer = await mutateAsync({ question: q, studyTitle });
        setMessages((prev) =>
          prev.concat([{ from: "assistant", who: es ? "Asistente" : "Assistant", text: answer.answer, refs: answer.references }])
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setMessages((prev) => prev.concat([{ from: "assistant", who: es ? "Asistente" : "Assistant", text: message, refs: [] }]));
      }
    },
    [es, isPending, mutateAsync]
  );

  const value = useMemo<AiChatContextValue>(() => ({ messages, pending: isPending, ask }), [messages, isPending, ask]);

  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>;
}

export function useAiChat(): AiChatContextValue {
  const ctx = useContext(AiChatContext);
  if (!ctx) throw new Error("useAiChat must be used within an AiChatProvider");
  return ctx;
}
