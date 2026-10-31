export interface AiReference {
  ref: string;
  why: string;
}

export interface AiAnswer {
  answer: string;
  references: AiReference[];
}

export type AiProvider = "anthropic" | "chatgpt";

export interface AiModelChoice {
  provider: AiProvider;
  model: string;
  label: string;
}

/** What src-tauri/src/chatgpt.rs tells the webview about an account. Never a token. */
export interface ChatgptAccount {
  sub: string;
  email: string | null;
  name: string | null;
  /** The plan-usage scope was granted. Signing in alone doesn't grant it. */
  planEnabled: boolean;
}

/** Every code a chatgpt_* command can fail with. */
export type ChatgptErrorCode =
  | "access_denied"
  | "account_mismatch"
  | "browser"
  | "cancelled"
  | "invalid_client"
  | "invalid_grant"
  | "invalid_id_token"
  | "network"
  | "oauth_error"
  | "random"
  | "reauth_required"
  | "refresh_failed"
  | "registration_incomplete"
  | "sign_out_first"
  | "storage"
  | "timeout";

export interface AskAiOptions {
  question: string;
  locale: "en" | "es";
  choice: AiModelChoice;
  /** The Anthropic API key. ChatGPT's tokens never leave the Rust side. */
  credential?: string;
  /** Title of the study being prepared, when asked from the study page. */
  studyTitle?: string;
  /** Called with the answer-so-far as the reply streams in. */
  onPartial?: (answer: AiAnswer) => void;
}
