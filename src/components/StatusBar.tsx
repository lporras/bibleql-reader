import type { JSX } from "react";
import { useParams } from "react-router-dom";
import { useAppState } from "../state/AppStateContext";
import { usePassage } from "../queries/usePassage";
import { useOfflineInstalled } from "../queries/useOfflineInstalled";
import { useInstallation } from "../queries/useInstallation";
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

  const offline = useOfflineInstalled();
  const installation = useInstallation();
  const sample = installation.failed && !offline.byId.has(state.transA);
  const statusLeft = sample ? t.sample : passageA.data?.translationNote || passageA.data?.translationName || "";
  const statusRight = `${installation.ready ? t.connected : installation.pending ? t.connecting : t.notConnected} · ${state.transA}${
    state.compare ? ` / ${state.transB}` : ""
  }`;

  return (
    <div className={styles.bar}>
      <span className={styles.left}>{statusLeft}</span>
      <span className={styles.right}>{statusRight}</span>
    </div>
  );
}
