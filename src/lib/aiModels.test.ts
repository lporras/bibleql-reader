import { describe, it, expect } from "vitest";
import { ANTHROPIC_CHOICE, effectiveProvider, pickChatgptModel, resolveChoice } from "./aiModels";

const A = { slug: "gpt-a", displayName: "GPT A" };
const B = { slug: "gpt-b", displayName: "GPT B" };

describe("effectiveProvider", () => {
  it("keeps what was selected when it can answer", () => {
    expect(effectiveProvider("anthropic", true, true, true)).toBe("anthropic");
    expect(effectiveProvider("chatgpt", true, true, true)).toBe("chatgpt");
  });

  it("uses ChatGPT when Claude has no key", () => {
    expect(effectiveProvider("anthropic", false, true, true)).toBe("chatgpt");
  });

  it("never falls back onto a billed key when ChatGPT signs out", () => {
    expect(effectiveProvider("chatgpt", true, false, true)).toBe("chatgpt");
  });

  it("is always Claude where ChatGPT isn't supported", () => {
    expect(effectiveProvider("chatgpt", true, true, false)).toBe("anthropic");
    expect(effectiveProvider("chatgpt", false, false, false)).toBe("anthropic");
  });
});

describe("pickChatgptModel", () => {
  it("starts on the first listed model", () => {
    expect(pickChatgptModel([A, B], undefined)).toBe(A);
    expect(pickChatgptModel([], undefined)).toBeNull();
  });

  it("keeps the saved model", () => {
    expect(pickChatgptModel([A, B], "gpt-b")).toBe(B);
  });

  it("doesn't silently switch when the saved model is gone", () => {
    expect(pickChatgptModel([A, B], "gpt-old")).toBeNull();
  });
});

describe("resolveChoice", () => {
  it("is Claude's one model with a key, and nothing without", () => {
    expect(resolveChoice("anthropic", true, false, null)).toBe(ANTHROPIC_CHOICE);
    expect(resolveChoice("anthropic", false, true, A)).toBeNull();
  });

  it("is the picked ChatGPT model when signed in", () => {
    expect(resolveChoice("chatgpt", false, true, A)).toEqual({ provider: "chatgpt", model: "gpt-a", label: "GPT A" });
  });

  it("is nothing without a sign-in or a model, even with a key saved", () => {
    expect(resolveChoice("chatgpt", true, false, A)).toBeNull();
    expect(resolveChoice("chatgpt", true, true, null)).toBeNull();
  });
});
