import { useEffect, useState, type JSX } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppState } from "../state/AppStateContext";
import { STR } from "../data/strings";
import { CHATGPT_SUPPORTED } from "../platform/host";
import { useChatgptAccount } from "../queries/useChatgptAccount";
import { ChatgptSection } from "./ChatgptSection";
import styles from "./KeyDialog.module.scss";

export function KeyDialog(): JSX.Element {
  const { state, actions } = useAppState();
  const t = STR[state.locale];
  const queryClient = useQueryClient();
  const chatgptReady = !!useChatgptAccount().data?.account?.planEnabled;
  const [aiKeyInput, setAiKeyInput] = useState(state.aiApiKey);

  useEffect(() => {
    setAiKeyInput(state.aiApiKey);
  }, [state.aiApiKey]);

  function handleSave(): void {
    actions.saveKeys(aiKeyInput.trim());
    // A key saved while ChatGPT can't answer is how someone picks Claude.
    if (aiKeyInput.trim() && !chatgptReady) actions.setAiProvider("anthropic");
    // A changed key doesn't change any query's cache key, so nothing would
    // otherwise refetch — force everything to reload against the new key.
    void queryClient.invalidateQueries();
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="ai-settings-title">
        <div id="ai-settings-title" className={styles.sectionTitle}>
          {t.aiSettings}
        </div>
        <label className={styles.fieldTitle} htmlFor="ai-api-key">
          {t.aiApiKey}
        </label>
        <p className={styles.help}>{t.aiKeyHelp}</p>
        <input
          id="ai-api-key"
          className={styles.input}
          value={aiKeyInput}
          onChange={(event) => setAiKeyInput(event.target.value)}
          placeholder="sk-ant-…"
        />

        {CHATGPT_SUPPORTED && <ChatgptSection />}

        <div className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={actions.closeKeyDialog}>
            {t.cancel}
          </button>
          <button type="button" className={styles.saveButton} onClick={handleSave}>
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
