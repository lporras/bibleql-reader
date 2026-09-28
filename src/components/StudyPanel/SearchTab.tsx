import { useState, type FormEvent, type JSX } from "react";
import { useAppState } from "../../state/AppStateContext";
import { useSearch } from "../../queries/useSearch";
import { useOpenRef } from "../../hooks/useOpenRef";
import { HAS_BIBLEQL_KEY } from "../../lib/graphql";
import { STR } from "../../data/strings";
import styles from "./SearchTab.module.scss";

interface SearchTabProps {
  active: boolean;
}

export function SearchTab({ active }: SearchTabProps): JSX.Element {
  const { state } = useAppState();
  const t = STR[state.locale];
  const openRef = useOpenRef();

  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  const search = useSearch(state.transA, query, !!query);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    const q = input.trim();
    if (!q) return;
    setQuery(q);
  }

  const hasKey = HAS_BIBLEQL_KEY;
  let notice = "";
  if (!hasKey) notice = t.noKey;
  else if (!query) notice = t.searchIdle;
  else if (search.isLoading) notice = t.loading;
  else if (search.error) notice = search.error.message;
  else if ((search.data ?? []).length === 0) notice = "—";

  const hits = search.data ?? [];

  return (
    <div className={styles.body} hidden={!active}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t.searchPlaceholder}
        />
        <button type="submit" className={styles.goButton}>
          {t.go}
        </button>
      </form>
      <div className={styles.results}>
        {notice && <div className={styles.notice}>{notice}</div>}
        {hits.map((h, i) => {
          const ref = `${h.bookName} ${h.chapter}:${h.verse}`;
          return (
            <div key={i} className={styles.hit}>
              <button type="button" className={styles.hitRef} onClick={() => openRef(ref)}>
                {ref}
              </button>
              <div className={styles.hitText}>{h.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
