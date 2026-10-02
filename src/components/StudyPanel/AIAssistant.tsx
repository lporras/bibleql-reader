import { useState, type FormEvent, type JSX, type KeyboardEvent } from "react";
import { useAppState } from "../../state/AppStateContext";
import { useAiChat } from "../../state/AiChatContext";
import { useOpenRef } from "../../hooks/useOpenRef";
import { useAddToStudy } from "../../hooks/useAddToStudy";
import { STR } from "../../data/strings";
import type { AiReference } from "../../types/ai";
import { CheckIcon, PlusIcon } from "../icons";
import styles from "./AIAssistant.module.scss";

interface AIAssistantProps {
  active: boolean;
  /** Set on the study page: steers answers toward the study being written. */
  studyTitle?: string;
  suggestions?: string[];
}

export function AIAssistant({ active, studyTitle, suggestions }: AIAssistantProps): JSX.Element {
  const { state } = useAppState();
  const t = STR[state.locale];
  const openRef = useOpenRef();
  const chat = useAiChat();
  const study = useAddToStudy();

  const [input, setInput] = useState("");

  function ask(question: string): void {
    if (!question.trim() || chat.pending) return;
    setInput("");
    void chat.ask(question, studyTitle);
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    ask(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) ask(input);
  }

  // Each reference is two targets: the reference itself opens it in the
  // reader (as before), and the "+" beside it sends it to the active study.
  // A reference that doesn't parse can't be stored or opened, so it gets
  // neither — the chip still shows what the assistant said.
  function renderRef(r: AiReference): JSX.Element {
    const draft = study.fromRef(r.ref, r.why);
    const inStudy = draft ? study.has(draft) : false;
    return (
      <span key={r.ref} className={styles.refChip}>
        <button
          type="button"
          className={styles.refOpen}
          title={r.why ? `${r.why}\n\n${t.openInReader}` : t.openInReader}
          onClick={() => openRef(r.ref)}
          disabled={!draft}
        >
          {r.ref}
        </button>
        {draft && (
          <button
            type="button"
            className={styles.refAdd}
            data-on={inStudy ? "yes" : "no"}
            title={inStudy ? t.refInStudy : t.addRefToStudy}
            aria-label={`${inStudy ? t.refInStudy : t.addRefToStudy}: ${r.ref}`}
            disabled={inStudy}
            onClick={() => study.add(draft)}
          >
            {inStudy ? <CheckIcon size={11} /> : <PlusIcon size={11} />}
          </button>
        )}
      </span>
    );
  }

  const prompts = suggestions ?? [t.s1, t.s2, t.s3];

  return (
    <div className={styles.body} hidden={!active}>
      <div className={styles.messages}>
        {chat.messages.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.introText}>{t.aiIntro}</p>
            <div className={styles.suggestions}>
              {prompts.map((text) => (
                <button key={text} type="button" className={styles.suggestion} onClick={() => setInput(text)}>
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.messages.map((m, i) => (
          <div key={i} className={styles.message}>
            <div className={styles.who}>{m.who}</div>
            <div className={styles.text}>{m.text}</div>
            {m.refs.length > 0 && <div className={styles.refs}>{m.refs.map(renderRef)}</div>}
          </div>
        ))}
        {chat.pending && <div className={styles.thinking}>{t.thinking}</div>}
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
