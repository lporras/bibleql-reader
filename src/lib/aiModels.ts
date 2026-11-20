import type { AiModelChoice, AiProvider, ChatgptModel } from "../types/ai";

// Claude has one fixed model, so there is nothing to discover or select.
export const ANTHROPIC_CHOICE: AiModelChoice = {
  provider: "anthropic",
  model: "claude-sonnet-5",
  label: "Claude"
};

// Foundation Models offers apps one general-purpose model, the system's own: no
// catalogue to list or pick from. See docs/apple-intelligence.md.
export const APPLE_CHOICE: AiModelChoice = {
  provider: "apple",
  model: "system",
  label: "Apple Intelligence"
};

/** What each provider needs, as far as the app can tell right now. */
export interface ProviderReadiness {
  hasKey: boolean;
  /** Signed in to ChatGPT with plan usage allowed. */
  chatgptReady: boolean;
  /** This platform can sign in to ChatGPT at all (CHATGPT_SUPPORTED). */
  chatgptSupported: boolean;
  /** Apple Intelligence's model is on this device and can answer now. */
  appleReady: boolean;
  /** This platform could have Apple Intelligence (APPLE_AI_SUPPORTED). */
  appleSupported: boolean;
}

/**
 * Which provider answers. A provider this platform can't have gives way to
 * Claude. Claude without a key can't answer, so someone signed in to ChatGPT
 * gets ChatGPT, and otherwise a device with Apple Intelligence gets that. The
 * reverse never happens on its own: a key is billed to its owner, so losing a
 * ChatGPT sign-in, or the on-device model, must not start spending it.
 */
export function effectiveProvider(selected: AiProvider, readiness: ProviderReadiness): AiProvider {
  const { hasKey, chatgptReady, chatgptSupported, appleReady, appleSupported } = readiness;
  let provider = selected;
  if (provider === "chatgpt" && !chatgptSupported) provider = "anthropic";
  if (provider === "apple" && !appleSupported) provider = "anthropic";
  if (provider === "anthropic" && !hasKey) {
    if (chatgptSupported && chatgptReady) return "chatgpt";
    if (appleSupported && appleReady) return "apple";
  }
  return provider;
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
  model: ChatgptModel | null,
  appleReady = false
): AiModelChoice | null {
  if (provider === "anthropic") return hasKey ? ANTHROPIC_CHOICE : null;
  if (provider === "apple") return appleReady ? APPLE_CHOICE : null;
  if (!chatgptReady || !model) return null;
  return { provider: "chatgpt", model: model.slug, label: model.displayName };
}
