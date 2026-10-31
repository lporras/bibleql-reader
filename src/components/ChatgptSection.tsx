import { useEffect, useRef, useState, type JSX } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppState } from "../state/AppStateContext";
import { STR } from "../data/strings";
import { MANAGE_USAGE_URL } from "../lib/externalLinks";
import { chatgpt, chatgptErrorCode, type ChatgptStatus } from "../platform/chatgpt";
import { useChatgptAccount } from "../queries/useChatgptAccount";
import { queryKeys } from "../queries/keys";
import type { ChatgptAccount } from "../types/ai";
import { ChatgptLogo } from "./icons";
import styles from "./ChatgptSection.module.scss";

interface ChatgptSectionProps {
  /** Set where it stands alone rather than following another section. */
  embedded?: boolean;
}

export function ChatgptSection({ embedded }: ChatgptSectionProps): JSX.Element | null {
  const { state } = useAppState();
  const t = STR[state.locale];
  const queryClient = useQueryClient();
  const status = useChatgptAccount();
  const [notice, setNotice] = useState<string | null>(null);

  // Both talk to OpenAI, but must still report back with the network down.
  const signIn = useMutation({
    networkMode: "always",
    mutationFn: (newAccount: boolean) => chatgpt.signIn(newAccount, state.locale),
    onMutate: () => setNotice(null),
    onSuccess: (account: ChatgptAccount) => {
      queryClient.setQueryData<ChatgptStatus>(queryKeys.chatgptAccount(), { account, hasRegistration: true });
    },
    onError: (error) => {
      const code = chatgptErrorCode(error);
      if (code !== "cancelled") setNotice(code ? t.chatgptError[code] : t.chatgptError.oauth_error);
    }
  });

  const signOut = useMutation({
    networkMode: "always",
    mutationFn: () => chatgpt.signOut(),
    onMutate: () => setNotice(null),
    onSuccess: ({ revoked }) => {
      queryClient.setQueryData<ChatgptStatus>(queryKeys.chatgptAccount(), { account: null, hasRegistration: true });
      if (!revoked) setNotice(t.chatgptRevokeUnconfirmed);
    },
    onError: () => setNotice(t.chatgptError.storage)
  });

  // Closing the dialog mid sign-in gives the attempt up rather than leaving a
  // listener waiting with nothing on screen to cancel it from.
  const pendingRef = useRef(false);
  pendingRef.current = signIn.isPending;
  useEffect(
    () => () => {
      if (pendingRef.current) void chatgpt.cancelSignIn();
    },
    []
  );

  if (!status.data) return null;
  const { account, hasRegistration } = status.data;

  return (
    <section className={embedded ? undefined : styles.section}>
      <h3 className={styles.title}>{t.chatgptPlanTitle}</h3>

      {signIn.isPending ? (
        <div className={styles.row}>
          <p className={styles.waiting}>{t.chatgptWaiting}</p>
          <button type="button" className={styles.plainButton} onClick={() => void chatgpt.cancelSignIn()}>
            {t.cancel}
          </button>
        </div>
      ) : account ? (
        <>
          <p className={styles.signedIn}>
            {account.email ? `${t.chatgptSignedInAs} ${account.email}` : t.chatgptSignedIn}
          </p>
          {account.planEnabled ? (
            <p className={styles.help}>{t.chatgptPlanNote}</p>
          ) : (
            <p className={styles.warning}>{t.chatgptPlanDisabled}</p>
          )}
          <div className={styles.row}>
            {!account.planEnabled && (
              <button type="button" className={styles.plainButton} onClick={() => signIn.mutate(false)}>
                {t.chatgptReconnect}
              </button>
            )}
            <button
              type="button"
              className={styles.plainButton}
              disabled={signOut.isPending}
              onClick={() => signOut.mutate()}
            >
              {t.chatgptSignOut}
            </button>
            <a className={styles.link} href={MANAGE_USAGE_URL}>
              {t.chatgptManageUsage}
            </a>
          </div>
        </>
      ) : (
        <>
          <p className={styles.help}>{t.chatgptPlanHelp}</p>
          <div className={styles.row}>
            <button type="button" className={styles.continueButton} onClick={() => signIn.mutate(false)}>
              <ChatgptLogo />
              {t.chatgptContinue}
            </button>
            {hasRegistration && (
              <button type="button" className={styles.textButton} onClick={() => signIn.mutate(true)}>
                {t.chatgptDifferentAccount}
              </button>
            )}
          </div>
        </>
      )}

      {notice && (
        <p className={styles.notice} role="alert">
          {notice}
        </p>
      )}
    </section>
  );
}
