import { OLLAMA_HOST } from "./aiModels";

export interface OllamaStatus {
  version: string;
  models: string[];
}

interface TagsResponse {
  models?: { name: string; capabilities?: string[] }[];
}

const TIMEOUT_MS = 2000;

async function getJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_HOST}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Ollama ${path} answered ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchOllamaStatus(): Promise<OllamaStatus | null> {
  try {
    const [{ version }, tags] = await Promise.all([
      getJson<{ version: string }>("/api/version"),
      getJson<TagsResponse>("/api/tags")
    ]);
    return { version, models: chatModels(tags) };
  } catch {
    return null;
  }
}

export function chatModels(tags: TagsResponse): string[] {
  return (tags.models ?? [])
    .filter((m) => !m.capabilities || m.capabilities.includes("completion"))
    .map((m) => m.name)
    .sort((a, b) => a.localeCompare(b));
}
