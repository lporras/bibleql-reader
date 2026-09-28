import type { JSX } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppState } from "../../state/AppStateContext";
import { STR } from "../../data/strings";
import { AIAssistant } from "./AIAssistant";
import { Concordance } from "./Concordance";
import { SearchTab } from "./SearchTab";
import styles from "./StudyPanel.module.scss";

const PANELS = ["ai", "conc", "search"] as const;
type PanelId = (typeof PANELS)[number];

// All three tabs stay mounted (hidden via the `hidden` attribute, not
// unmounted) so switching tabs never loses a chat transcript, a concordance
// lookup, or a search result — each tab owns its own state.
export function StudyPanel(): JSX.Element {
  const { state } = useAppState();
  const t = STR[state.locale];
  const navigate = useNavigate();
  const { bookId = "PSA", chapter = "1", panel = "ai" } = useParams();
  const activePanel: PanelId = (PANELS as readonly string[]).includes(panel) ? (panel as PanelId) : "ai";

  function switchTo(next: PanelId): void {
    navigate(`/read/${bookId}/${chapter}/${next}`, { replace: true });
  }

  return (
    <div className={styles.panel}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={styles.tab}
          data-tab={activePanel === "ai" ? "on" : "off"}
          onClick={() => switchTo("ai")}
        >
          {t.assistant}
        </button>
        <button
          type="button"
          className={styles.tab}
          data-tab={activePanel === "conc" ? "on" : "off"}
          onClick={() => switchTo("conc")}
        >
          {t.concordance}
        </button>
        <button
          type="button"
          className={styles.tab}
          data-tab={activePanel === "search" ? "on" : "off"}
          onClick={() => switchTo("search")}
        >
          {t.search}
        </button>
      </div>

      <AIAssistant active={activePanel === "ai"} />
      <Concordance active={activePanel === "conc"} />
      <SearchTab active={activePanel === "search"} />
    </div>
  );
}
