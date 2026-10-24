import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { chatModels, fetchOllamaStatus } from "./ollama";

const fetchMock = vi.fn();

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("chatModels", () => {
  it("drops embedding-only models and sorts the rest", () => {
    expect(
      chatModels({
        models: [
          { name: "qwen3:8b", capabilities: ["completion", "tools"] },
          { name: "nomic-embed-text:latest", capabilities: ["embedding"] },
          { name: "gemma4:e4b", capabilities: ["completion", "vision"] }
        ]
      })
    ).toEqual(["gemma4:e4b", "qwen3:8b"]);
  });

  it("keeps models from servers too old to report capabilities", () => {
    expect(chatModels({ models: [{ name: "llama3:latest" }] })).toEqual(["llama3:latest"]);
  });
});

describe("fetchOllamaStatus", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reports the version and pulled chat models", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith("/api/version")
          ? json({ version: "0.40.10" })
          : json({ models: [{ name: "gemma4:e4b", capabilities: ["completion"] }] })
      )
    );

    expect(await fetchOllamaStatus()).toEqual({ version: "0.40.10", models: ["gemma4:e4b"] });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:11434/api/version",
      "http://localhost:11434/api/tags"
    ]);
  });

  it("is null when Ollama isn't running", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await fetchOllamaStatus()).toBeNull();
  });

  it("is null when Ollama refuses the origin", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 403 }));
    expect(await fetchOllamaStatus()).toBeNull();
  });
});
