import { useLayoutEffect, useRef, useState, type FormEvent, type JSX, type KeyboardEvent } from "react";
import { useAppState } from "../../state/AppStateContext";
import { useAiChat } from "../../state/AiChatContext";
import { useOpenRef } from "../../hooks/useOpenRef";
import { useAddToStudy } from "../../hooks/useAddToStudy";
import { translationAbbrev } from "../../state/study";
import { STR } from "../../data/strings";
import { buildAiReportUrl } from "../../lib/aiReport";
import { openExternal } from "../../lib/externalLinks";
import type { AiReference } from "../../types/ai";
import { CheckIcon, FlagIcon, PlusIcon } from "../icons";
import { AiText } from "./AiText";
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

  // Follow the reply as it streams in, like a terminal: keep the newest
  // lines in view while the user is at the bottom, but stop following once
  // they scroll up to reread something, and pick up again when they return
  // or ask a new question.
  const messagesRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);

  function handleScroll(): void {
    const el = messagesRef.current;
    if (el) followRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  useLayoutEffect(() => {
    const el = messagesRef.current;
    if (el && active && followRef.current) el.scrollTop = el.scrollHeight;
  }, [chat.messages, chat.thinking, active]);

  function ask(question: string): void {
    if (!question.trim() || chat.pending) return;
    setInput("");
    followRef.current = true;
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
            // Added in the translation being read; say which.
            title={`${inStudy ? t.refInStudy : t.addRefToStudy} (${translationAbbrev(state.transA)})`}
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

  // Google Play's AI-Generated Content policy: every answer can be reported.
  // The form opens in the system browser, prefilled with this exchange.
  function report(index: number): void {
    const answer = chat.messages[index];
    const prev = chat.messages[index - 1];
    openExternal(
      buildAiReportUrl({
        question: prev?.from === "user" ? prev.text : "",
        response: answer.text,
        locale: state.locale,
      })
    );
  }

  const prompts = suggestions ?? [t.s1, t.s2, t.s3];

  return (
    <div className={styles.body} hidden={!active}>
      <div ref={messagesRef} className={styles.messages} onScroll={handleScroll}>
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
            {m.from === "assistant" ? <AiText text={m.text} /> : <div className={styles.text}>{m.text}</div>}
            {m.refs.length > 0 && <div className={styles.refs}>{m.refs.map(renderRef)}</div>}
            {/* Not until the reply has finished streaming in — a half answer isn't what the user would be reporting. */}
            {m.from === "assistant" && m.text && !(chat.pending && i === chat.messages.length - 1) && (
              <button
                type="button"
                className={styles.report}
                title={t.reportResponseHelp}
                aria-label={t.reportResponseHelp}
                onClick={() => report(i)}
              >
                <FlagIcon size={11} />
                {t.reportResponse}
              </button>
            )}
          </div>
        ))}
        {chat.thinking && <div className={styles.thinking}>{t.thinking}</div>}
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
