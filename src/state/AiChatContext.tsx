import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useAppState } from "./AppStateContext";
import { useAi } from "../queries/useAi";
import { findAiModel } from "../lib/aiModels";
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
  /** True from asking until the reply has fully streamed in. */
  pending: boolean;
  /** True while waiting for the first streamed words of a reply. */
  thinking: boolean;
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
  const modelLabel = findAiModel(state.aiModel).label;
  const ai = useAi();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { isPending, mutateAsync } = ai;

  const ask = useCallback(
    async (question: string, studyTitle?: string) => {
      const q = question.trim();
      if (!q || isPending) return;
      setMessages((prev) => prev.concat([{ from: "user", who: es ? "Tú" : "You", text: q, refs: [] }]));
      // The assistant's message appears with the first streamed words (until
      // then the panel shows "Thinking…") and is replaced in place as more
      // arrive. `replace` is read before the update is queued: React may run
      // the updater later, by which point `started` is already true.
      let started = false;
      const who = `${es ? "Asistente" : "Assistant"} · ${modelLabel}`;
      const show = (text: string, refs: AiReference[]): void => {
        const replace = started;
        started = true;
        const message: ChatMessage = { from: "assistant", who, text, refs };
        setMessages((prev) => (replace ? prev.slice(0, -1) : prev).concat([message]));
      };
      try {
        const answer = await mutateAsync({
          question: q,
          studyTitle,
          onPartial: (partial) => {
            if (partial.answer) show(partial.answer, partial.references);
          }
        });
        show(answer.answer, answer.references);
      } catch (err) {
        show(err instanceof Error ? err.message : String(err), []);
      }
    },
    [es, modelLabel, isPending, mutateAsync]
  );

  const thinking = isPending && messages[messages.length - 1]?.from === "user";
  const value = useMemo<AiChatContextValue>(
    () => ({ messages, pending: isPending, thinking, ask }),
    [messages, isPending, thinking, ask]
  );

  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>;
}

export function useAiChat(): AiChatContextValue {
  const ctx = useContext(AiChatContext);
  if (!ctx) throw new Error("useAiChat must be used within an AiChatProvider");
  return ctx;
}
