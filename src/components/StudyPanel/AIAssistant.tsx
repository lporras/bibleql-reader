import { useLayoutEffect, useRef, useState, type FormEvent, type JSX, type KeyboardEvent } from "react";
import { useAppState } from "../../state/AppStateContext";
import { useAiChat } from "../../state/AiChatContext";
import { useOpenRef } from "../../hooks/useOpenRef";
import { useAddToStudy } from "../../hooks/useAddToStudy";
import { useChatgptAccount } from "../../queries/useChatgptAccount";
import { CHATGPT_SUPPORTED } from "../../platform/host";
import { translationAbbrev } from "../../state/study";
import { STR } from "../../data/strings";
import type { AiReference } from "../../types/ai";
import { CheckIcon, PlusIcon } from "../icons";
import { ChatgptSection } from "../ChatgptSection";
import { AiText } from "./AiText";
import styles from "./AIAssistant.module.scss";

interface AIAssistantProps {
  active: boolean;
  /** Set on the study page: steers answers toward the study being written. */
  studyTitle?: string;
  suggestions?: string[];
}

export function AIAssistant({ active, studyTitle, suggestions }: AIAssistantProps): JSX.Element {
  const { state, actions } = useAppState();
  const t = STR[state.locale];
  const chatgptStatus = useChatgptAccount();
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

  const prompts = suggestions ?? [t.s1, t.s2, t.s3];

  // Nothing can answer yet, so show how to fix that rather than a box whose
  // every question would fail. Not while the account is still loading: that
  // would flash the prompt at someone already signed in.
  const needsSetup = !state.aiApiKey.trim() && !chatgptStatus.isLoading && !chatgptStatus.data?.account?.planEnabled;

  return (
    <div className={styles.body} hidden={!active}>
      <div ref={messagesRef} className={styles.messages} onScroll={handleScroll}>
        {needsSetup && (
          <div className={styles.setup}>
            <h3 className={styles.setupTitle}>{t.aiSetupTitle}</h3>
            <p className={styles.setupHelp}>{t.aiSetupHelp}</p>
            {CHATGPT_SUPPORTED && <ChatgptSection embedded />}
            <button type="button" className={styles.setupKey} onClick={actions.openKeyDialog}>
              {t.aiSetupKey}
            </button>
          </div>
        )}
        {!needsSetup && chat.messages.length === 0 && (
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
          </div>
        ))}
        {chat.thinking && <div className={styles.thinking}>{t.thinking}</div>}
      </div>
      {!needsSetup && (
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
      )}
    </div>
  );
}
