import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AiAnswer, AppleAiEvent } from "../types/ai";

// The seam to the on-device model (plugins/tauri-plugin-appleai). Foundation
// Models itself can't run in a test; these cover what becomes of its events.
type Request = { instructions: string; prompt: string };
type Script = (request: Request, onEvent: (event: AppleAiEvent) => void) => Promise<void>;
const respond = vi.fn<Script>();
const fetchMock = vi.fn();
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: (...args: unknown[]) => fetchMock(...args) }));
vi.mock("../platform/appleai", () => ({
  appleAi: { respond: (request: Request, onEvent: (event: AppleAiEvent) => void) => respond(request, onEvent) }
}));

const { askAi, buildAppleInstructions, describeAppleFailure } = await import("./ai");
const { APPLE_CHOICE } = await import("./aiModels");

const ANSWER: AiAnswer = { answer: "A priest and king.", references: [{ ref: "Genesis 14:18", why: "He appears." }] };

function replies(...events: AppleAiEvent[]): void {
  respond.mockImplementation(async (_, onEvent) => events.forEach(onEvent));
}

function partial(answer: string, references: { ref: string; why?: string }[] = []): AppleAiEvent {
  return { type: "partial", answer, references };
}

function ask(onPartial?: (answer: AiAnswer) => void, locale: "en" | "es" = "en"): Promise<AiAnswer> {
  return askAi({ question: "Who is Melchizedek?", locale, choice: APPLE_CHOICE, onPartial });
}

describe("askAi with Apple Intelligence", () => {
  beforeEach(() => {
    respond.mockReset();
    fetchMock.mockReset();
  });

  it("asks the on-device model with its own instructions, and nothing goes over the network", async () => {
    replies(partial(ANSWER.answer, ANSWER.references), { type: "completed" });
    await ask(undefined, "es");
    const [request] = respond.mock.calls[0];
    expect(request.prompt).toBe("Who is Melchizedek?");
    expect(request.instructions).toBe(buildAppleInstructions("es"));
    // Guided generation fixes the shape: no JSON instructions needed.
    expect(request.instructions).not.toContain("JSON");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("streams partials, showing a reference only once it has a reason", async () => {
    replies(
      partial("A priest"),
      partial("A priest and king.", [{ ref: "Genesis 14:18" }]),
      partial("A priest and king.", ANSWER.references),
      { type: "completed" }
    );
    const seen: AiAnswer[] = [];
    await expect(ask((a) => seen.push(a))).resolves.toEqual(ANSWER);
    expect(seen.map((a) => a.references.length)).toEqual([0, 0, 1]);
    expect(seen[0].answer).toBe("A priest");
  });

  it("explains a failure in the reader's language", async () => {
    replies(partial("A"), { type: "failed", code: "guardrailViolation", message: "nope" });
    await expect(ask(undefined, "es")).rejects.toThrow(describeAppleFailure("guardrailViolation", "es"));
  });

  it("explains a request that couldn't start", async () => {
    respond.mockRejectedValue(new Error("unsupportedOS"));
    await expect(ask()).rejects.toThrow(/iPadOS 26 or macOS 26/);
  });

  it("lists a passage the model repeated only once", async () => {
    replies(partial(ANSWER.answer, [...ANSWER.references, ANSWER.references[0]]), { type: "completed" });
    const seen: AiAnswer[] = [];
    await expect(ask((a) => seen.push(a))).resolves.toEqual(ANSWER);
    expect(seen[0].references).toHaveLength(1);
  });

  it("drops a reference that can't be opened, such as a made-up book name", async () => {
    replies(partial(ANSWER.answer, [...ANSWER.references, { ref: "Micael 5:2", why: "A prophecy." }]), { type: "completed" });
    await expect(ask()).resolves.toEqual(ANSWER);
  });

  it("names each passage in the reader's language, whatever the model wrote", async () => {
    replies(partial("Sí.", [{ ref: "Zechariah 12:10", why: "Lo traspasaron." }, { ref: "Zacarías 12:10", why: "Otra vez." }]), {
      type: "completed"
    });
    await expect(ask(undefined, "es")).resolves.toEqual({ answer: "Sí.", references: [{ ref: "Zacarías 12:10", why: "Lo traspasaron." }] });
  });

  it("rejects a reply that ended with no answer", async () => {
    replies({ type: "completed" });
    await expect(ask()).rejects.toThrow(/expected format/);
  });
});

describe("describeAppleFailure", () => {
  it("has a message for every known code, and a generic one otherwise", () => {
    expect(describeAppleFailure("modelNotReady-ish", "en")).toMatch(/couldn't answer/);
    expect(describeAppleFailure("concurrentRequests", "en")).toMatch(/another question/);
    expect(describeAppleFailure("exceededContextWindowSize", "es")).toMatch(/demasiado larga/);
  });
});

describe("buildAppleInstructions", () => {
  // English instructions got guided generation refused; see the function's comment.
  it("is written in Spanish whatever the answer's language, and names that language", () => {
    expect(buildAppleInstructions("es")).toMatch(/^Eres un asistente cuidadoso de estudio bíblico/);
    expect(buildAppleInstructions("en")).toMatch(/^Eres un asistente cuidadoso de estudio bíblico/);
    expect(buildAppleInstructions("es")).toContain("Escribe todo en español");
    expect(buildAppleInstructions("en")).toContain("Escribe todo en inglés");
    expect(buildAppleInstructions("en")).toContain("nombre completo del libro en inglés");
  });

  it("gives no example reference for the model to copy", () => {
    expect(buildAppleInstructions("es")).not.toMatch(/\d+:\d+/);
    expect(buildAppleInstructions("en")).not.toMatch(/\d+:\d+/);
  });

  it("steers toward the study being prepared, when there is one", () => {
    expect(buildAppleInstructions("en", "  God's Rest ")).toContain('titulado "God\'s Rest"');
    expect(buildAppleInstructions("en", "   ")).not.toContain("titulado");
  });
});
