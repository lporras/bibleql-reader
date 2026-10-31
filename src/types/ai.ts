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
