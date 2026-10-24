import { describe, it, expect } from "vitest";
import { AI_MODELS, DEFAULT_AI_MODEL, aiModelGroups, findAiModel } from "./aiModels";

describe("findAiModel", () => {
  it("finds a model by id", () => {
    expect(findAiModel("ollama:gemma4:e4b").model).toBe("gemma4:e4b");
  });

  it("falls back to the default for a stored id that no longer exists", () => {
    expect(findAiModel("retired-model").id).toBe(DEFAULT_AI_MODEL);
    expect(findAiModel(undefined).id).toBe(DEFAULT_AI_MODEL);
    expect(findAiModel("ollama:").id).toBe(DEFAULT_AI_MODEL);
  });

  it("resolves any Ollama model, labelled by its own name unless it's a listed one", () => {
    expect(findAiModel("ollama:qwen3:8b")).toEqual({
      id: "ollama:qwen3:8b",
      provider: "ollama",
      model: "qwen3:8b",
      label: "qwen3:8b"
    });
    expect(findAiModel("ollama:gemma4:e4b").label).toBe("Gemma 4 (local)");
  });

  it("has unique ids, since they're persisted", () => {
    expect(new Set(AI_MODELS.map((m) => m.id)).size).toBe(AI_MODELS.length);
  });
});

describe("aiModelGroups", () => {
  it("lists what Ollama has pulled", () => {
    const groups = aiModelGroups(["gemma4:e4b", "qwen3:8b"], DEFAULT_AI_MODEL);
    expect(groups.anthropic.map((m) => m.id)).toEqual(["claude-sonnet-5"]);
    expect(groups.ollama.map((m) => m.label)).toEqual(["Gemma 4 (local)", "qwen3:8b"]);
  });

  it("falls back to the listed stand-ins while Ollama is unreachable", () => {
    expect(aiModelGroups(undefined, DEFAULT_AI_MODEL).ollama.map((m) => m.id)).toEqual(["ollama:gemma4:e4b"]);
  });

  it("keeps a selected model that's no longer installed, so the picker can show it", () => {
    expect(aiModelGroups(["gemma4:e4b"], "ollama:llama3").ollama.map((m) => m.id)).toEqual([
      "ollama:llama3",
      "ollama:gemma4:e4b"
    ]);
  });
});
