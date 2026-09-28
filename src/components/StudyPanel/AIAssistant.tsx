import { useState, type FormEvent, type JSX, type KeyboardEvent } from "react";
import { useAppState } from "../../state/AppStateContext";
import { useAi } from "../../queries/useAi";
import { useOpenRef } from "../../hooks/useOpenRef";
import { STR } from "../../data/strings";
import type { AiReference } from "../../types/ai";
import styles from "./AIAssistant.module.scss";

interface ChatMessage {
  who: string;
  text: string;
  refs: AiReference[];
}

interface AIAssistantProps {
  active: boolean;
}

export function AIAssistant({ active }: AIAssistantProps): JSX.Element {
  const { state } = useAppState();
  const t = STR[state.locale];
  const es = state.locale === "es";
  const openRef = useOpenRef();
  const ai = useAi();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");

  async function ask(question: string): Promise<void> {
    const q = question.trim();
    if (!q || ai.isPending) return;
    setMessages((prev) => prev.concat([{ who: es ? "Tú" : "You", text: q, refs: [] }]));
    setInput("");
    try {
      const answer = await ai.mutateAsync(q);
      setMessages((prev) =>
        prev.concat([{ who: es ? "Asistente" : "Assistant", text: answer.answer, refs: answer.references }])
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessages((prev) => prev.concat([{ who: es ? "Asistente" : "Assistant", text: message, refs: [] }]));
    }
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    void ask(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void ask(input);
  }

  const suggestions = [t.s1, t.s2, t.s3];

  return (
    <div className={styles.body} hidden={!active}>
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.introText}>{t.aiIntro}</p>
            <div className={styles.suggestions}>
              {suggestions.map((text) => (
                <button key={text} type="button" className={styles.suggestion} onClick={() => setInput(text)}>
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={styles.message}>
            <div className={styles.who}>{m.who}</div>
            <div className={styles.text}>{m.text}</div>
            {m.refs.length > 0 && (
              <div className={styles.refs}>
                {m.refs.map((r) => (
                  <button
                    key={r.ref}
                    type="button"
                    className={styles.refChip}
                    title={r.why}
                    onClick={() => openRef(r.ref)}
                  >
                    {r.ref}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {ai.isPending && <div className={styles.thinking}>{t.thinking}</div>}
      </div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <textarea
          className={styles.textarea}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.aiPlaceholder}
          rows={3}
        />
        <button type="submit" className={styles.askButton}>
          {t.ask}
        </button>
      </form>
    </div>
  );
}
