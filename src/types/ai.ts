export interface AiReference {
  ref: string;
  why: string;
}

export interface AiAnswer {
  answer: string;
  references: AiReference[];
}
