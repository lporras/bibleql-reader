import { useState, type FormEvent, type JSX } from "react";
import { useAppState } from "../../state/AppStateContext";
import { useConcordanceSupport } from "../../queries/useConcordanceSupport";
import { useConcordance } from "../../queries/useConcordance";
import { useTranslations } from "../../queries/useTranslations";
import { HAS_BIBLEQL_KEY } from "../../lib/graphql";
import { useOpenRef } from "../../hooks/useOpenRef";
import { fillTemplate, stripMarkContext } from "../../lib/format";
import { STR } from "../../data/strings";
import styles from "./Concordance.module.scss";

interface ConcordanceProps {
  active: boolean;
}

export function Concordance({ active }: ConcordanceProps): JSX.Element {
  const { state } = useAppState();
  const t = STR[state.locale];
  const openRef = useOpenRef();

  const [input, setInput] = useState("");
  const [word, setWord] = useState("");

  const support = useConcordanceSupport(state.transA);
  const translations = useTranslations();
  const supported = !!support.data;
  const query = useConcordance(state.transA, word, !!word && supported);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    const w = input.trim();
    if (!w) return;
    setWord(w);
  }

  const hasKey = HAS_BIBLEQL_KEY;
  let notice = "";
  if (!hasKey) {
    notice = t.noKey;
  } else if (!word) {
    notice = t.concIdle;
  } else if (support.isLoading) {
    notice = t.loading;
  } else if (!supported) {
    const indexed = (translations.data ?? []).filter((x) => x.concordanceIndexedAt).map((x) => x.identifier);
    notice = fillTemplate(t.concUnsupported, {
      s: state.transA,
      l: indexed.length ? indexed.join(", ") : "spa-rv1909, spa-nvi"
    });
  } else if (query.isLoading) {
    notice = t.loading;
  } else if (query.error) {
    notice = query.error.message;
  }

  const pages = query.data?.pages ?? [];
  const entry = pages[0]?.entry ?? null;
  const hits = pages.flatMap((p) => p.hits);

  return (
    <div className={styles.body} hidden={!active}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t.concPlaceholder}
        />
        <button type="submit" className={styles.lookButton}>
          {t.look}
        </button>
      </form>
      <div className={styles.results}>
        {notice && <div className={styles.notice}>{notice}</div>}
        {entry && (
          <div className={styles.entry}>
            <div className={styles.entryForms}>{entry.surfaceForms.slice(0, 6).join(" · ")}</div>
            <div className={styles.entryMeta}>
              <span>
                {entry.totalOccurrences} {t.occ}
              </span>
              <span>
                {entry.verseCount} {t.versesN}
              </span>
              <span>
                {t.old} {entry.occurrencesByTestament.old} / {t.nw} {entry.occurrencesByTestament.new}
              </span>
            </div>
          </div>
        )}
        {hits.map((h, i) => {
          const { pre, hit, post } = stripMarkContext(h.context);
          const ref = `${h.verse.bookName} ${h.verse.chapter}:${h.verse.verse}`;
          return (
            <div key={i} className={styles.hit}>
              <button type="button" className={styles.hitRef} onClick={() => openRef(ref)}>
                {ref}
              </button>
              <div className={styles.hitContext}>
                {pre}
                <span className={styles.hitWord}>{hit}</span>
                {post}
              </div>
            </div>
          );
        })}
        {query.hasNextPage && (
          <button type="button" className={styles.moreButton} onClick={() => query.fetchNextPage()}>
            {t.more}
          </button>
        )}
      </div>
    </div>
  );
}
