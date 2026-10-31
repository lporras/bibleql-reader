import type { AiModelChoice } from "../types/ai";

// Claude has one fixed model, so there is nothing to discover or select.
export const ANTHROPIC_CHOICE: AiModelChoice = {
  provider: "anthropic",
  model: "claude-sonnet-5",
  label: "Claude"
};
