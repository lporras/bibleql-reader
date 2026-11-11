import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AiAnswer, ChatgptEvent, ChatgptRequest } from "../types/ai";

// The seam to Rust, which holds the tokens and talks to OpenAI. Its own tests
// (src-tauri/src/chatgpt.rs) cover the stream; these cover what becomes of it.
type Script = (request: ChatgptRequest, onEvent: (event: ChatgptEvent) => void) => Promise<void>;
const respond = vi.fn<Script>();
const fetchMock = vi.fn();
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: (...args: unknown[]) => fetchMock(...args) }));
vi.mock("../platform/chatgpt", async (original) => ({
  ...(await original<typeof import("../platform/chatgpt")>()),
  chatgpt: { respond: (request: ChatgptRequest, onEvent: (event: ChatgptEvent) => void) => respond(request, onEvent) }
}));

const { askAi, ChatgptRequestError, describeChatgptFailure, stripCodeFence } = await import("./ai");

const CHOICE = { provider: "chatgpt" as const, model: "gpt-a", label: "GPT A" };
const ANSWER: AiAnswer = { answer: "A priest and king.", references: [{ ref: "Genesis 14:18", why: "He appears." }] };

function replies(...events: ChatgptEvent[]): void {
  respond.mockImplementation(async (_, onEvent) => events.forEach(onEvent));
}

function chunks(text: string, size = 7): ChatgptEvent[] {
  const events: ChatgptEvent[] = [];
  for (let i = 0; i < text.length; i += size) events.push({ type: "delta", text: text.slice(i, i + size) });
  return events;
}

function ask(onPartial?: (answer: AiAnswer) => void, locale: "en" | "es" = "en"): Promise<AiAnswer> {
  return askAi({ question: "Who is Melchizedek?", locale, choice: CHOICE, onPartial });
}

function failed(fields: Partial<Extract<ChatgptEvent, { type: "failed" }>>): ChatgptEvent {
  return { type: "failed", status: null, code: null, param: null, message: null, ...fields };
}

describe("askAi with ChatGPT", () => {
  beforeEach(() => {
    respond.mockReset();
    fetchMock.mockReset();
  });

  it("asks through Rust for the chosen model, with no credential and the JSON shape", async () => {
    replies(...chunks(JSON.stringify(ANSWER)), { type: "completed" });
    await ask();
    const [request] = respond.mock.calls[0];
    expect(request.model).toBe("gpt-a");
    expect(request.input).toBe("Who is Melchizedek?");
    expect(request.instructions).toContain("Bible study assistant");
    expect(request.instructions).toContain('"references"');
    expect(request).not.toHaveProperty("credential");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves with the validated answer", async () => {
    replies(...chunks(JSON.stringify(ANSWER)), { type: "completed" });
    await expect(ask()).resolves.toEqual(ANSWER);
  });

  it("shows the answer growing as it streams, in order", async () => {
    replies(...chunks(JSON.stringify(ANSWER)), { type: "completed" });
    const seen: string[] = [];
    await ask((partial) => seen.push(partial.answer));
    const distinct = seen.filter((text, i) => text && text !== seen[i - 1]);
    expect(distinct.length).toBeGreaterThan(2);
    expect(distinct.at(-1)).toBe(ANSWER.answer);
    for (let i = 1; i < distinct.length; i++) expect(distinct[i].startsWith(distinct[i - 1])).toBe(true);
  });

  it("copes with a code fence around the JSON, while streaming too", async () => {
    replies(...chunks("```json\n" + JSON.stringify(ANSWER) + "\n```"), { type: "completed" });
    const seen: string[] = [];
    await expect(ask((partial) => seen.push(partial.answer))).resolves.toEqual(ANSWER);
    expect(seen.at(-1)).toBe(ANSWER.answer);
  });

  it("rejects a reply that isn't the expected JSON", async () => {
    for (const text of ["Melchizedek was a priest.", '{"answer":"no references"}']) {
      replies(...chunks(text), { type: "completed" });
      await expect(ask()).rejects.toMatchObject({ code: "bad_format" });
    }
  });

  it("doesn't treat text as an answer unless the reply completed", async () => {
    replies(...chunks(JSON.stringify(ANSWER)), failed({ code: "incomplete" }));
    await expect(ask()).rejects.toThrow(/stopped before finishing/);
    replies(...chunks(JSON.stringify(ANSWER)), failed({ code: "stream_interrupted" }));
    await expect(ask()).rejects.toThrow(/connection dropped/);
  });

  it("reports a mid-stream usage limit", async () => {
    replies(...chunks('{"answer":"A'), failed({ code: "subscription_sharing_usage_limit_exceeded" }));
    const error = await ask().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ChatgptRequestError);
    expect(error).toMatchObject({ code: "subscription_sharing_usage_limit_exceeded" });
    expect((error as Error).message).toMatch(/Manage usage/);
  });

  it("carries the failure's param for the caller to act on", async () => {
    replies(failed({ code: "subscription_sharing_unsupported_capability", param: "model" }));
    await expect(ask()).rejects.toMatchObject({ param: "model" });
  });

  it("explains a request that never went out, in the current language", async () => {
    respond.mockRejectedValue(new Error("reauth_required"));
    await expect(ask(undefined, "es")).rejects.toMatchObject({
      code: "reauth_required",
      message: expect.stringContaining("Vuelve a iniciar sesión")
    });
  });
});

describe("describeChatgptFailure", () => {
  const describeIt = (fields: Parameters<typeof failed>[0]): string =>
    describeChatgptFailure(failed(fields) as Extract<ChatgptEvent, { type: "failed" }>, "en");

  it("says the limit is reached, without guessing when it resets", () => {
    const text = describeIt({ code: "subscription_sharing_usage_limit_exceeded" });
    expect(text).toMatch(/limit/);
    expect(text).not.toMatch(/tomorrow|hours|reset/i);
  });

  it("treats usage_unavailable as temporary, not as a plan problem", () => {
    const text = describeIt({ code: "subscription_sharing_usage_unavailable", status: 503 });
    expect(text).toMatch(/temporarily/);
    expect(text).not.toMatch(/Plus or Pro/);
  });

  it("names the plan requirement only for real ineligibility", () => {
    expect(describeIt({ code: "subscription_sharing_user_not_eligible", status: 403 })).toMatch(/Plus or Pro/);
  });

  it("doesn't tell someone to sign in again over a plain 401", () => {
    const text = describeIt({ status: 401, message: "Not accepted" });
    expect(text).not.toMatch(/sign in/i);
    expect(text).toContain("Not accepted");
  });

  it("names what's unsupported", () => {
    expect(describeIt({ code: "subscription_sharing_unsupported_capability", param: "tools" })).toContain("tools");
    expect(describeIt({ code: "subscription_sharing_unsupported_capability", param: "model" })).toMatch(/Choose another/);
  });

  it("maps statuses and unknown codes", () => {
    expect(describeIt({ code: "chatpass_v2_scope_not_authorized", status: 403 })).toMatch(/blocked/);
    expect(describeIt({ status: 403 })).toMatch(/blocked/);
    expect(describeIt({ status: 503 })).toMatch(/temporarily/);
    expect(describeIt({ status: 429 })).toMatch(/limit/);
    expect(describeIt({ code: "something_new" })).toMatch(/couldn't answer/);
  });
});

describe("stripCodeFence", () => {
  it("removes only a surrounding fence", () => {
    expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripCodeFence('```\n{"a":1}```')).toBe('{"a":1}');
    expect(stripCodeFence(' {"a":"`x`"} ')).toBe('{"a":"`x`"}');
  });
});
