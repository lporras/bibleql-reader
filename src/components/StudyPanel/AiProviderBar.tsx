import { useEffect, type ChangeEvent, type JSX } from "react";
import { useAppState } from "../../state/AppStateContext";
import { STR } from "../../data/strings";
import { useAiChoice } from "../../queries/useAiModels";
import { ChatgptSection } from "../ChatgptSection";
import styles from "./AiProviderBar.module.scss";

// Who answers in the Assistant, and with which model. Changing either keeps the
// conversation: the transcript belongs to AiChatContext, not to a provider.
export function AiProviderBar(): JSX.Element {
  const { state, actions } = useAppState();
  const t = STR[state.locale];
  const { provider, hasKey, chatgptReady, models, chatgptModel } = useAiChoice();

  // Save the preselected model, so that if it later leaves the list the reader is
  // asked to choose rather than quietly moved to whatever is first by then.
  const saved = state.aiModels.chatgpt;
  const preselected = provider === "chatgpt" && chatgptReady && !saved ? chatgptModel?.slug : undefined;
  useEffect(() => {
    if (preselected) actions.setChatgptModel(preselected);
  }, [preselected, actions]);

  function handleProvider(event: ChangeEvent<HTMLSelectElement>): void {
    const next = event.target.value as "anthropic" | "chatgpt";
    actions.setAiProvider(next);
    // Claude needs a key before it can be what answers.
    if (next === "anthropic" && !hasKey) actions.openKeyDialog();
  }

  const showModels = provider === "chatgpt" && chatgptReady;

  return (
    <div className={styles.bar}>
      <div className={styles.selects}>
        <label className={styles.picker}>
          <span className={styles.label}>{t.aiProvider}</span>
          <select value={provider} onChange={handleProvider}>
            <option value="anthropic">{hasKey ? "Claude" : t.aiClaudeNeedsKey}</option>
            <option value="chatgpt">ChatGPT</option>
          </select>
        </label>
        {showModels && models.data && models.data.length > 0 && (
          <label className={styles.picker}>
            <span className={styles.label}>{t.aiModel}</span>
            <select value={chatgptModel?.slug ?? ""} onChange={(event) => actions.setChatgptModel(event.target.value)}>
              {!chatgptModel && (
                <option value="" disabled>
                  {t.aiChooseModel}
                </option>
              )}
              {models.data.map((model) => (
                <option key={model.slug} value={model.slug}>
                  {model.displayName}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {provider === "chatgpt" && !chatgptReady && <ChatgptSection embedded />}

      {showModels && models.isPending && <p className={styles.status}>{t.aiModelsLoading}</p>}
      {showModels && models.isError && <p className={styles.problem}>{t.aiModelsError}</p>}
      {showModels && models.data?.length === 0 && <p className={styles.problem}>{t.aiModelsEmpty}</p>}
      {showModels && models.data && models.data.length > 0 && !chatgptModel && (
        <p className={styles.problem}>{t.aiModelGone}</p>
      )}

      {showModels && <p className={styles.plan}>{t.chatgptUsingPlan}</p>}
    </div>
  );
}
