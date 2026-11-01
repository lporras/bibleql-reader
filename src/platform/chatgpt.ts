import { Channel } from "@tauri-apps/api/core";
import { call, hasShell } from "./shell";
import type { ChatgptAccount, ChatgptErrorCode, ChatgptEvent, ChatgptModel, ChatgptRequest } from "../types/ai";

// Sign in with ChatGPT: the seam to src-tauri/src/chatgpt.rs, which does the
// OAuth flow and keeps every token. Only safe account details cross this
// boundary. See docs/chatgpt-sign-in.md.
//
// Outside a Tauri shell there is no account: ChatGPT is hidden there anyway
// (CHATGPT_SUPPORTED in platform/host.ts).
export interface ChatgptStatus {
  account: ChatgptAccount | null;
  /** Someone has signed in on this install before, so a sign-in can differ from them. */
  hasRegistration: boolean;
}

export const chatgpt = {
  async status(): Promise<ChatgptStatus> {
    if (!hasShell()) return { account: null, hasRegistration: false };
    const [account, hasRegistration] = await Promise.all([
      call<ChatgptAccount | null>("chatgpt_account"),
      call<boolean | null>("chatgpt_has_registration")
    ]);
    return { account: account ?? null, hasRegistration: !!hasRegistration };
  },
  /** Opens the system browser and resolves once sign-in has finished. */
  signIn(newAccount: boolean, locale: string): Promise<ChatgptAccount> {
    return call<ChatgptAccount>("chatgpt_sign_in", { newAccount, locale });
  },
  async cancelSignIn(): Promise<void> {
    await call("chatgpt_cancel_sign_in");
  },
  /** `revoked` is false if OpenAI couldn't confirm it; the local tokens are gone either way. */
  signOut(): Promise<{ revoked: boolean }> {
    return call<{ revoked: boolean }>("chatgpt_sign_out");
  },
  async models(): Promise<ChatgptModel[]> {
    return (await call<ChatgptModel[] | null>("chatgpt_models")) ?? [];
  },
  /**
   * Streams one reply through Rust, which holds the token. Rejects if nothing
   * was sent; once sent, the reply always ends on a `completed` or `failed` event.
   */
  async respond(request: ChatgptRequest, onEvent: (event: ChatgptEvent) => void): Promise<void> {
    const channel = new Channel<ChatgptEvent>();
    channel.onmessage = onEvent;
    await call("chatgpt_respond", { ...request, onEvent: channel });
  }
};

/** The code from a failed command, which is the whole of its error message. */
export function chatgptErrorCode(error: unknown): ChatgptErrorCode | null {
  const code = error instanceof Error ? error.message : String(error);
  return CODES.has(code as ChatgptErrorCode) ? (code as ChatgptErrorCode) : null;
}

const CODES: ReadonlySet<ChatgptErrorCode> = new Set<ChatgptErrorCode>([
  "access_denied",
  "account_mismatch",
  "browser",
  "cancelled",
  "invalid_client",
  "invalid_grant",
  "invalid_id_token",
  "models_failed",
  "network",
  "oauth_error",
  "plan_disabled",
  "random",
  "reauth_required",
  "refresh_failed",
  "registration_incomplete",
  "sign_out_first",
  "storage",
  "timeout"
]);
