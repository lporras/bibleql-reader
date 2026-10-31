import { useState, type JSX } from "react";
import { useAppState } from "../state/AppStateContext";
import { readPrefs, writePrefs } from "../state/persist";
import { STR } from "../data/strings";
import { useChatgptAccount } from "../queries/useChatgptAccount";
import { MANAGE_USAGE_URL } from "../lib/externalLinks";
import styles from "./ChatgptWelcome.module.scss";

// OpenAI's guidelines show this the first time plan usage is on. It lives at the
// app root, not with the sign-in button: the Assistant's setup prompt, which has
// one of those buttons, goes away the moment the sign-in succeeds.
export function ChatgptWelcome(): JSX.Element | null {
  const { state } = useAppState();
  const t = STR[state.locale];
  const status = useChatgptAccount();
  const [welcomed, setWelcomed] = useState(() => !!readPrefs().chatgptWelcomed);

  if (welcomed || !status.data?.account?.planEnabled) return null;

  function dismiss(): void {
    writePrefs({ chatgptWelcomed: true });
    setWelcomed(true);
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.welcome} role="dialog" aria-modal="true" aria-labelledby="chatgpt-welcome-title">
        <h3 id="chatgpt-welcome-title" className={styles.title}>
          {t.chatgptWelcomeTitle}
        </h3>
        <p className={styles.help}>
          {t.chatgptWelcomeBody}{" "}
          <a className={styles.link} href={MANAGE_USAGE_URL}>
            {t.chatgptManageUsage}
          </a>
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={dismiss}>
            {t.chatgptGotIt}
          </button>
        </div>
      </div>
    </div>
  );
}
