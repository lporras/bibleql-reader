import { describe, it, expect } from "vitest";
import { ANTHROPIC_CHOICE, APPLE_CHOICE, effectiveProvider, pickChatgptModel, resolveChoice, type ProviderReadiness } from "./aiModels";

const A = { slug: "gpt-a", displayName: "GPT A" };
const B = { slug: "gpt-b", displayName: "GPT B" };

// A desktop where everything is possible but nothing is set up.
const NONE: ProviderReadiness = {
  hasKey: false,
  chatgptReady: false,
  chatgptSupported: true,
  appleReady: false,
  appleSupported: true
};
const ready = (patch: Partial<ProviderReadiness>): ProviderReadiness => ({ ...NONE, ...patch });

describe("effectiveProvider", () => {
  it("keeps what was selected when it can answer", () => {
    expect(effectiveProvider("anthropic", ready({ hasKey: true, chatgptReady: true }))).toBe("anthropic");
    expect(effectiveProvider("chatgpt", ready({ hasKey: true, chatgptReady: true }))).toBe("chatgpt");
    expect(effectiveProvider("apple", ready({ hasKey: true, appleReady: true }))).toBe("apple");
  });

  it("uses ChatGPT when Claude has no key", () => {
    expect(effectiveProvider("anthropic", ready({ chatgptReady: true, appleReady: true }))).toBe("chatgpt");
  });

  it("uses Apple Intelligence when Claude has no key and ChatGPT can't answer", () => {
    expect(effectiveProvider("anthropic", ready({ appleReady: true }))).toBe("apple");
    expect(effectiveProvider("anthropic", ready({ appleReady: true, chatgptSupported: false }))).toBe("apple");
  });

  it("never falls back onto a billed key when ChatGPT signs out", () => {
    expect(effectiveProvider("chatgpt", ready({ hasKey: true }))).toBe("chatgpt");
  });

  it("never falls back onto a billed key when the on-device model can't answer", () => {
    expect(effectiveProvider("apple", ready({ hasKey: true }))).toBe("apple");
  });

  it("is Claude where ChatGPT isn't supported", () => {
    expect(effectiveProvider("chatgpt", ready({ hasKey: true, chatgptReady: true, chatgptSupported: false }))).toBe("anthropic");
    expect(effectiveProvider("chatgpt", ready({ chatgptSupported: false }))).toBe("anthropic");
  });

  it("is Claude where Apple Intelligence isn't supported", () => {
    expect(effectiveProvider("apple", ready({ appleSupported: false }))).toBe("anthropic");
    expect(effectiveProvider("anthropic", ready({ appleReady: true, appleSupported: false }))).toBe("anthropic");
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

  it("is Apple Intelligence's one model once it can answer, and nothing before", () => {
    expect(resolveChoice("apple", false, false, null, true)).toBe(APPLE_CHOICE);
    expect(resolveChoice("apple", true, true, A, false)).toBeNull();
  });
});
