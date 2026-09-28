import type { JSX } from "react";
import { useNavigate } from "react-router-dom";
import { STR, type Locale } from "../../../data/strings";
import type { BibleSource } from "../model/types";
import styles from "./ScripturePanel.module.scss";

interface ScripturePanelProps {
  locale: Locale;
  bibleSource?: BibleSource;
}

export function ScripturePanel({ locale, bibleSource }: ScripturePanelProps): JSX.Element {
  const t = STR[locale];
  const navigate = useNavigate();

  // Reuses the Reader's own verse-selection UI rather than duplicating it
  // (spec §13) — both "change" and "add" just send the user back there.
  function goToReader(): void {
    navigate("/");
  }

  return (
    <div className={styles.panel}>
      <div className={styles.sectionTitle}>{t.scripture}</div>
      {bibleSource ? (
        <>
          <p className={styles.reference}>{bibleSource.reference}</p>
          <button type="button" className={styles.actionButton} onClick={goToReader}>
            {t.changeSelection}
          </button>
        </>
      ) : (
        <button type="button" className={styles.actionButton} onClick={goToReader}>
          {t.addScripture}
        </button>
      )}
    </div>
  );
}
