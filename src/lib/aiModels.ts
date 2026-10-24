export type AiProvider = "anthropic" | "ollama";

export interface AiModelOption {
  id: string;
  provider: AiProvider;
  model: string;
  label: string;
}

export const OLLAMA_HOST = __OLLAMA_URL__;
export const OLLAMA_BASE_URL = `${OLLAMA_HOST}/v1`;

const OLLAMA_LABELS: Record<string, string> = {
  "gemma4:e4b": "Gemma 4 (local)"
};

const OLLAMA_PREFIX = "ollama:";

export function ollamaModel(name: string): AiModelOption {
  return { id: OLLAMA_PREFIX + name, provider: "ollama", model: name, label: OLLAMA_LABELS[name] ?? name };
}

export const AI_MODELS: AiModelOption[] = [
  { id: "claude-sonnet-5", provider: "anthropic", model: "claude-sonnet-5", label: "Claude Sonnet 5" },
  ollamaModel(__OLLAMA_MODEL__)
];

export const DEFAULT_AI_MODEL = AI_MODELS[0].id;

export function findAiModel(id: string | undefined): AiModelOption {
  if (id?.startsWith(OLLAMA_PREFIX) && id.length > OLLAMA_PREFIX.length) {
    return ollamaModel(id.slice(OLLAMA_PREFIX.length));
  }
  return AI_MODELS.find((m) => m.id === id) ?? AI_MODELS[0];
}

export interface AiModelGroups {
  anthropic: AiModelOption[];
  ollama: AiModelOption[];
}

export function aiModelGroups(installed: string[] | undefined, selectedId: string): AiModelGroups {
  const anthropic = AI_MODELS.filter((m) => m.provider === "anthropic");
  const ollama = installed ? installed.map(ollamaModel) : AI_MODELS.filter((m) => m.provider === "ollama");
  const selected = findAiModel(selectedId);
  if (selected.provider === "ollama" && !ollama.some((m) => m.id === selected.id)) ollama.unshift(selected);
  return { anthropic, ollama };
}
