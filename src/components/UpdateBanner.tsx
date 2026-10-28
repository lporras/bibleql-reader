import { useState, useSyncExternalStore, type JSX } from "react";
import { useAppState } from "../state/AppStateContext";
import { getUpdateNotice, subscribeUpdateNotice } from "../lib/graphql";
import { STR } from "../data/strings";
import { CloseIcon } from "./icons";
import styles from "./UpdateBanner.module.scss";

// Shown when BibleQL marks this build's key as deprecated: every request
// still works (rate-limited), and the response says where to update. Never
// blocks the app; dismissed for the session.
export function UpdateBanner(): JSX.Element | null {
  const { state } = useAppState();
  const t = STR[state.locale];
  const notice = useSyncExternalStore(subscribeUpdateNotice, getUpdateNotice);
  const [dismissed, setDismissed] = useState(false);

  if (!notice || dismissed) return null;

  return (
    <div className={styles.banner} role="status">
      <span className={styles.message}>{notice.message}</span>
      {/* Opened in the system browser by lib/externalLinks.ts. */}
      <a className={styles.link} href={notice.updateUrl}>
        {t.updateGet}
      </a>
      <button type="button" className={styles.close} onClick={() => setDismissed(true)} aria-label={t.close} title={t.close}>
        <CloseIcon size={13} />
      </button>
    </div>
  );
}
