import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mocks the Tauri HTTP plugin rather than letting anything reach
// api.anthropic.com — per this project's standing rule, specs never call
// a live service. This is the seam that carries the API key, so it's
// exactly what's worth pinning down.
const fetchMock = vi.fn();
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: (...args: unknown[]) => fetchMock(...args) }));

const { askAi } = await import("./ai");

function claude(anthropicApiKey: string) {
  return { locale: "en" as const, modelId: "claude-sonnet-5", anthropicApiKey };
}

const gemma = { locale: "en" as const, modelId: "ollama:gemma4:e4b", anthropicApiKey: "" };

function headerFrom(init: RequestInit | undefined, name: string): string | undefined {
  const headers = init?.headers as Record<string, string> | undefined;
  if (!headers) return undefined;
  const hit = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return hit?.[1];
}

describe("askAi", () => {
  beforeEach(() => fetchMock.mockReset());

  it("refuses to call out at all when no key is configured", async () => {
    await expect(askAi("Who is Melchizedek?", claude("   "))).rejects.toThrow(/No Anthropic API key/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the key verbatim as x-api-key", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ type: "error", error: { message: "nope" } }), {
        status: 401,
        headers: { "content-type": "application/json" }
      })
    );

    await expect(askAi("Who is Melchizedek?", claude("sk-ant-test-123"))).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("api.anthropic.com");
    // The exact value the user typed, with no mangling — this is the
    // regression guard for "my key works in the old app but not here".
    expect(headerFrom(init, "x-api-key")).toBe("sk-ant-test-123");
    expect(headerFrom(init, "anthropic-version")).toBe("2023-06-01");
  });

  // tauri-plugin-http strips the caller's Origin and then sets its own
  // unconditionally (see its commands.rs), so Anthropic always sees this
  // as a cross-origin call and answers 401 "CORS requests must set
  // 'anthropic-dangerous-direct-browser-access' header" without this.
  // Routing through Rust is necessary but not sufficient.
  it("opts in to direct browser access, which the plugin's forced Origin requires", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ type: "error", error: { message: "nope" } }), {
        status: 401,
        headers: { "content-type": "application/json" }
      })
    );

    await expect(askAi("Who is Melchizedek?", claude("sk-ant-test-123"))).rejects.toThrow();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(headerFrom(init, "anthropic-dangerous-direct-browser-access")).toBe("true");
  });

  it("reports a 401 as a rejected key, and keeps the API's own wording", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ type: "error", error: { message: "API key is invalid." } }), {
        status: 401,
        headers: { "content-type": "application/json" }
      })
    );

    await expect(askAi("Who is Melchizedek?", claude("sk-ant-bad"))).rejects.toThrow(
      /rejected.*API key is invalid/s
    );
  });
});

describe("askAi with Ollama", () => {
  const webFetch = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    webFetch.mockReset();
    vi.stubGlobal("fetch", webFetch);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("needs no API key and calls the local OpenAI-compatible endpoint, not the plugin", async () => {
    webFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "nope" } }), {
        status: 400,
        headers: { "content-type": "application/json" }
      })
    );

    await expect(askAi("Who is Melchizedek?", gemma)).rejects.toThrow();

    expect(fetchMock).not.toHaveBeenCalled();
    const [url, init] = webFetch.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe("http://localhost:11434/v1/chat/completions");
    expect(JSON.parse(String(init.body)).model).toBe("gemma4:e4b");
  });

  it("says Ollama isn't running when the connection fails", async () => {
    webFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(askAi("Who is Melchizedek?", gemma)).rejects.toThrow(/reach Ollama.*running/);
  });

  it("names the pull command when the model isn't installed", async () => {
    webFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'model "gemma4:e4b" not found' } }), {
        status: 404,
        headers: { "content-type": "application/json" }
      })
    );

    await expect(askAi("Who is Melchizedek?", gemma)).rejects.toThrow(/ollama pull gemma4:e4b/);
  });
});
