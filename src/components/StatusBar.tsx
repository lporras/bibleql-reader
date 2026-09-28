import type { JSX } from "react";
import { useParams } from "react-router-dom";
import { useAppState } from "../state/AppStateContext";
import { usePassage } from "../queries/usePassage";
import { HAS_BIBLEQL_KEY } from "../lib/graphql";
import { STR } from "../data/strings";
import styles from "./StatusBar.module.scss";

// Shares its usePassage("a", ...) cache entry with ReaderPane's column A —
// same query key, same react-query cache, no extra network request.
export function StatusBar(): JSX.Element {
  const { state } = useAppState();
  const t = STR[state.locale];
  const { bookId = "PSA", chapter: chapterParam } = useParams();
  const chapter = Number(chapterParam) || 1;
  const passageA = usePassage("a", state.transA, bookId, chapter);

  const statusLeft = !HAS_BIBLEQL_KEY ? t.sample : passageA.data?.translationNote || passageA.data?.translationName || "";
  const statusRight = `${HAS_BIBLEQL_KEY ? t.keySet : t.apiKey} · ${state.transA}${
    state.compare ? ` / ${state.transB}` : ""
  }`;

  return (
    <div className={styles.bar}>
      <span className={styles.left}>{statusLeft}</span>
      <span className={styles.right}>{statusRight}</span>
    </div>
  );
}
