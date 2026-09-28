import type { JSX } from "react";
import { useAppState } from "../../state/AppStateContext";
import { IS_MAC } from "../../platform/host";
import { STR } from "../../data/strings";
import { CompareIcon, KeyIcon, MoonIcon, StudyIcon, SunIcon } from "../icons";
import { RefSearchForm } from "./RefSearchForm";
import styles from "./TitleBar.module.scss";

export function TitleBar(): JSX.Element {
  const { state, actions } = useAppState();
  const t = STR[state.locale];
  const isDark = state.theme === "dark";

  return (
    <div className={styles.bar} data-tauri-drag-region="deep">
      {/* macOS draws its own traffic lights inset over the window
          (titleBarStyle: "Overlay" + hiddenTitle in tauri.conf.json) —
          this just reserves space so the wordmark does not render
          underneath them. Windows/Linux keep a normal OS title bar. */}
      {IS_MAC && <div className={styles.trafficLightsSpacer} />}

      <div className={styles.wordmark}>
        <span className={styles.title}>Bible Reader</span>
        <span className={styles.kicker}>BibleQL</span>
      </div>

      <RefSearchForm />

      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.toolButton}
          data-active={state.compare}
          title={t.compare}
          onClick={actions.toggleCompare}
        >
          <CompareIcon />
          <span>{t.compare}</span>
        </button>
        <button
          type="button"
          className={styles.toolButton}
          data-active={state.panelOpen}
          title={t.panel}
          onClick={actions.togglePanel}
        >
          <StudyIcon />
          <span>{t.panel}</span>
        </button>
        <span className={styles.divider} />
        <button type="button" className={styles.localeButton} title="Language" onClick={actions.toggleLocale}>
          {state.locale === "es" ? "ES" : "EN"}
        </button>
        <button type="button" className={styles.iconButton} title={t.theme} onClick={actions.toggleTheme}>
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
        <button type="button" className={styles.iconButton} title={t.aiApiKey} onClick={actions.openKeyDialog}>
          <KeyIcon />
        </button>
      </div>
    </div>
  );
}
