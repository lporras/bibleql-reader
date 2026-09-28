export interface AiReference {
  ref: string;
  why: string;
}

export interface AiAnswer {
  answer: string;
  references: AiReference[];
}

export interface AskAiArgs {
  question: string;
  locale: "en" | "es";
  anthropicApiKey: string;
}
