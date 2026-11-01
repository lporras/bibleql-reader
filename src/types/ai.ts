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
  | "models_failed"
  | "network"
  | "oauth_error"
  | "plan_disabled"
  | "random"
  | "reauth_required"
  | "refresh_failed"
  | "registration_incomplete"
  | "sign_out_first"
  | "storage"
  | "timeout";

export interface ChatgptModel {
  slug: string;
  displayName: string;
}

export interface ChatgptRequest {
  model: string;
  instructions: string;
  input: string;
}

/** A reply as it arrives from src-tauri/src/chatgpt.rs. Only `completed` is success. */
export type ChatgptEvent =
  | { type: "delta"; text: string }
  | { type: "completed" }
  | ({ type: "failed" } & ChatgptFailure);

export interface ChatgptFailure {
  status: number | null;
  code: string | null;
  param: string | null;
  message: string | null;
}

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
