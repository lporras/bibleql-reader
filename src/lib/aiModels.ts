import type { AiModelChoice, AiProvider, ChatgptModel } from "../types/ai";

// Claude has one fixed model, so there is nothing to discover or select.
export const ANTHROPIC_CHOICE: AiModelChoice = {
  provider: "anthropic",
  model: "claude-sonnet-5",
  label: "Claude"
};

/**
 * Which provider answers. Claude without a key can't, so someone signed in to
 * ChatGPT gets ChatGPT. The reverse never happens on its own: a key is billed to
 * its owner, so losing a ChatGPT sign-in must not start spending it.
 */
export function effectiveProvider(selected: AiProvider, hasKey: boolean, chatgptReady: boolean, supported: boolean): AiProvider {
  if (!supported) return "anthropic";
  return selected === "anthropic" && !hasKey && chatgptReady ? "chatgpt" : selected;
}

/**
 * The first listed model when nothing has been picked yet. A saved model that's
 * gone gives `null`: the reader chooses again rather than being moved silently.
 */
export function pickChatgptModel(models: ChatgptModel[], saved: string | undefined): ChatgptModel | null {
  if (saved) return models.find((m) => m.slug === saved) ?? null;
  return models[0] ?? null;
}

/** What can answer right now, or `null` if the reader has something to do first. */
export function resolveChoice(
  provider: AiProvider,
  hasKey: boolean,
  chatgptReady: boolean,
  model: ChatgptModel | null
): AiModelChoice | null {
  if (provider === "anthropic") return hasKey ? ANTHROPIC_CHOICE : null;
  if (!chatgptReady || !model) return null;
  return { provider: "chatgpt", model: model.slug, label: model.displayName };
}
