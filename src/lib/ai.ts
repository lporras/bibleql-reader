import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { NoObjectGeneratedError, NoOutputGeneratedError, Output, parsePartialJson, streamText, type DeepPartial } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { STR, type Locale } from "../data/strings";
import { appleAi } from "../platform/appleai";
import { chatgpt, chatgptErrorCode } from "../platform/chatgpt";
import { bookLabel, parseRef } from "./refs";
import type { AiAnswer, AiReference, AppleAiEvent, AskAiOptions, ChatgptFailure } from "../types/ai";

// Was the `ai:ask` Electron IPC handler (src/main/ipc/ai.ts), which ran
// in the Node main process. Tauri has no Node side, so the whole thing
// runs here in the webview instead — `ai` and `@ai-sdk/anthropic` are
// isomorphic (fetch + web streams, no Node APIs).
//
// The one thing that can't be plain browser `fetch`: api.anthropic.com
// refuses cross-origin requests. Handing `createAnthropic` the HTTP
// plugin's `fetch` makes Rust issue the request, which is what gets us
// past the browser's own CORS preflight. The allowed URL is scoped in
// src-tauri/capabilities/default.json.
//
// That is NOT enough on its own, though. tauri-plugin-http strips the
// caller's Origin as a forbidden header and then unconditionally sets
// its own (`http://localhost:1420` in dev, `tauri://localhost` when
// bundled) — see its commands.rs, "ensure we have an Origin header set".
// There's no way to suppress that without the plugin's `unsafe-headers`
// cargo feature. So Anthropic still sees an Origin, still classifies the
// call as a browser request, and answers 401 with "CORS requests must
// set 'anthropic-dangerous-direct-browser-access' header" until we send it.
//
// Sending it is the intended use here, not a bypass: that header guards
// against a *website* shipping its key to every visitor's browser. This
// is a desktop app, the key is the user's own, typed into the key dialog
// and kept in their own localStorage, and the request is issued by the
// Rust process — no third party can script it.
//
// The key is still never bundled: it lives in localStorage and is passed
// in per call, exactly as it was through the IPC boundary.

const AiAnswerSchema = z.object({
  answer: z.string(),
  references: z.array(z.object({ ref: z.string(), why: z.string() }))
});

function buildSystemPrompt(locale: "en" | "es", studyTitle?: string): string {
  const es = locale === "es";
  // On the study page the user is preparing a sermon or lesson; naming it
  // lets "suggest verses" and outline questions answer for that theme.
  const study = studyTitle?.trim()
    ? ` The user is preparing a sermon or Bible study titled "${studyTitle.trim()}"; when a question is open-ended, ` +
      "favor references and insights that would serve that study."
    : "";
  return (
    "You are a careful Bible study assistant inside a Bible reading app. Answer in " +
    (es ? "Spanish" : "English") +
    ". Be concise (120 words maximum), grounded in the biblical text, and note when " +
    "faithful traditions read a passage differently instead of asserting one view. " +
    // The answer is shown as paragraphs and lists (lib/aiText.ts); without
    // this it tends to arrive as one run-on block.
    "Format the answer for easy reading: short paragraphs separated by a blank line (\\n\\n); " +
    'an outline or several points as a list, one item per line starting with "1." or "-"; ' +
    "**bold** only for a key phrase; no headings, no tables. Always put a space after every period. " +
    "Reply with structured data: " +
    "an answer and 2 to 5 references. Each reference's `ref` must be a plain reference like " +
    `"${es ? "Mateo 18:21-22" : "Matthew 18:21-22"}" using ${es ? "Spanish" : "English"} book names.` +
    study
  );
}

/**
 * Anthropic's own wording for a failure, dug out of the response body.
 *
 * Worth surfacing rather than discarding: a 401 can mean the key is
 * wrong, but it can equally mean the key is the wrong *kind* of
 * credential for this API, and "The Anthropic API key was rejected."
 * alone cannot tell those apart — which makes a working key that
 * suddenly "doesn't work" impossible to diagnose from the UI.
 */
function apiDetail(err: unknown): string | undefined {
  const body = (err as { responseBody?: string }).responseBody;
  if (!body) return undefined;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
    return parsed.error?.message ?? parsed.message;
  } catch {
    return body.slice(0, 200);
  }
}

function withDetail(summary: string, err: unknown): string {
  const detail = apiDetail(err);
  return detail ? `${summary} (${detail})` : summary;
}

function describeAiError(err: unknown): string {
  if (NoObjectGeneratedError.isInstance(err) || NoOutputGeneratedError.isInstance(err)) {
    return "The assistant's reply didn't match the expected format. Try rephrasing.";
  }
  const statusCode = (err as { statusCode?: number }).statusCode;
  if (statusCode === 401 || statusCode === 403) {
    return withDetail("The Anthropic API key was rejected.", err);
  }
  if (statusCode === 429) {
    return withDetail("Rate limited by Anthropic. Try again in a moment.", err);
  }
  const detail = apiDetail(err);
  const message = (err as { message?: string }).message;
  return detail ?? message ?? "The AI assistant request failed.";
}

/**
 * What a half-streamed reply can show. References only count once their
 * `ref` is complete — keys stream in schema order, so that's as soon as
 * `why` has started — or a chip would flicker through "Mat", "Matt"…
 */
function partialAnswer(partial: DeepPartial<AiAnswer> | undefined): AiAnswer {
  return {
    answer: partial?.answer ?? "",
    references: (partial?.references ?? []).filter((r): r is AiReference => !!r?.ref && r.why !== undefined)
  };
}

// The ChatGPT plan route documents plain text streaming, but neither
// structured output nor top-level function tools (it rejects those), so the
// answer's shape is asked for in the instructions instead. `answer` comes first
// so it can be shown while it streams.
const JSON_INSTRUCTIONS =
  " Reply with only a JSON object, with no code fence and no other text, with its keys in this order: " +
  '{"answer": string, "references": [{"ref": string, "why": string}]}.';

/** A model may wrap its JSON in a code fence despite being asked not to. */
export function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

/** A failed ChatGPT request. `code` lets callers react, as well as explain. */
export class ChatgptRequestError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly param: string | null
  ) {
    super(message);
  }
}

/** What a failed reply means to the reader. See OpenAI's "Errors and recovery". */
export function describeChatgptFailure(failure: ChatgptFailure, locale: "en" | "es"): string {
  const t = STR[locale].chatgptFailure;
  const withDiagnostic = (summary: string): string => (failure.message ? `${summary} (${failure.message})` : summary);
  switch (failure.code) {
    case "subscription_sharing_usage_limit_exceeded":
      return t.limit;
    case "subscription_sharing_usage_unavailable":
    case "subscription_sharing_user_unavailable":
      return t.unavailable;
    case "subscription_sharing_user_not_eligible":
      return t.notEligible;
    case "subscription_sharing_unsupported_capability":
      return failure.param === "model" ? t.modelUnavailable : withDiagnostic(`${t.unsupported} ${failure.param ?? ""}`.trim());
    case "subscription_sharing_invalid_user":
      return withDiagnostic(t.credential);
    case "incomplete":
      return t.incomplete;
    case "stream_interrupted":
      return t.interrupted;
    case "network":
      return STR[locale].chatgptError.network;
  }
  if (failure.code?.startsWith("chatpass_v2_")) return withDiagnostic(t.restricted);
  if (failure.status === 401) return withDiagnostic(t.credential);
  if (failure.status === 403) return withDiagnostic(t.restricted);
  if (failure.status === 503) return t.unavailable;
  if (failure.status === 429) return t.limit;
  return withDiagnostic(t.generic);
}

async function askChatgpt({ question, locale, choice, studyTitle, onPartial }: AskAiOptions): Promise<AiAnswer> {
  let text = "";
  // parsePartialJson is async: keep each partial in the order it arrived.
  let shown = Promise.resolve();
  const showPartial = (): void => {
    const soFar = text;
    shown = shown.then(async () => {
      const { value } = await parsePartialJson(stripCodeFence(soFar));
      if (value && typeof value === "object") onPartial?.(partialAnswer(value as DeepPartial<AiAnswer>));
    });
  };

  await new Promise<void>((resolve, reject) => {
    chatgpt
      .respond(
        {
          model: choice.model,
          instructions: buildSystemPrompt(locale, studyTitle) + JSON_INSTRUCTIONS,
          input: question
        },
        (event) => {
          if (event.type === "delta") {
            text += event.text;
            showPartial();
          } else if (event.type === "completed") {
            resolve();
          } else {
            reject(new ChatgptRequestError(describeChatgptFailure(event, locale), event.code, event.param));
          }
        }
      )
      .catch((err: unknown) => {
        const code = chatgptErrorCode(err);
        reject(new ChatgptRequestError(STR[locale].chatgptError[code ?? "oauth_error"], code, null));
      });
  });

  await shown;
  try {
    return AiAnswerSchema.parse(JSON.parse(stripCodeFence(text)));
  } catch {
    throw new ChatgptRequestError(STR[locale].chatgptFailure.badFormat, "bad_format", null);
  }
}

// Apple Intelligence: the on-device model, through plugins/tauri-plugin-appleai.
// Guided generation makes the model produce exactly {answer, references}, so
// unlike ChatGPT there is no JSON to ask for or repair: each event already
// carries the answer so far.

/**
 * The on-device model's instructions: the same brief as buildSystemPrompt, but
 * **always written in Spanish**, with the answer's language named in them.
 *
 * Not a translation for its own sake. Tested on macOS 26.6 (SDK 27.2), guided
 * generation under *English* instructions was refused almost every time ("I
 * apologize, but I cannot fulfill this request", a `refusal`), whatever the
 * question. Even "You are a Bible study assistant. Be concise (120 words
 * maximum)." was enough. The same instructions in Spanish were never refused, in
 * either answer language, across 26 runs. There is also no example reference:
 * the model copied whichever one it was given into nearly every answer. Recheck
 * both after an OS update (docs/apple-intelligence.md has the harness).
 *
 * It also insists on one language throughout: Spanish answers picked up English
 * words ("fulfillment", "Zechariah"). And it doesn't ask for blank lines between
 * paragraphs: in a guided string a blank line ends the field, which cut answers
 * short, so core/ generates paragraphs as a list and joins them itself. No bold
 * either: given the choice, it bolded word after word and left stray "**".
 */
export function buildAppleInstructions(locale: "en" | "es", studyTitle?: string): string {
  const es = locale === "es";
  const study = studyTitle?.trim()
    ? ` El usuario prepara un sermón o estudio bíblico titulado "${studyTitle.trim()}"; cuando la pregunta sea abierta, ` +
      "prefiere referencias e ideas que sirvan a ese estudio."
    : "";
  const language = es ? "español" : "inglés";
  return (
    "Eres un asistente cuidadoso de estudio bíblico dentro de una aplicación para leer la Biblia. Escribe todo en " +
    `${language}, también los nombres de los libros y los motivos, sin mezclar palabras de otro idioma. ` +
    "La respuesta debe ser concisa (máximo 120 palabras) y estar completa: no la termines anunciando una lista que " +
    "no escribes. Apégate al texto bíblico y, cuando tradiciones fieles lean un pasaje de forma distinta, menciónalo " +
    "en lugar de afirmar una sola postura. No copies el texto de los versículos: la aplicación lo muestra. Da formato " +
    "fácil de leer: párrafos cortos, de una a tres frases; un esquema o varios puntos como lista, cada elemento " +
    'empezando con "1." o "-"; sin negritas, títulos ni tablas. ' +
    "Pon siempre un espacio después de cada punto. Después de la respuesta, da de 2 a 5 referencias. Cada cita es " +
    `un solo pasaje: libro, capítulo y versículos, con el nombre completo del libro en ${language}, sin abreviar. Cada motivo ` +
    "es una sola frase corta y completa, sin otras referencias." +
    study
  );
}

/** What a failed on-device reply means to the reader. */
export function describeAppleFailure(code: string, locale: "en" | "es"): string {
  const t = STR[locale].appleAiFailure;
  return code in t ? t[code as keyof typeof t] : t.generic;
}

/**
 * The answer a `partial` event carries. A reference counts once it has a reason,
 * and only once: the small model sometimes lists the same passage twice.
 */
export function applePartial(event: Extract<AppleAiEvent, { type: "partial" }>, locale: Locale): AiAnswer {
  return partialAnswer({ answer: event.answer, references: appleRefs(event.references, locale) });
}

/**
 * The model's references worth a chip: each passage once, only ones that open,
 * and named in the reader's language. Other providers' unparseable references
 * get a disabled chip, but the small model makes up book names ("Micael 5:2")
 * often enough that those are dropped; and it sometimes names a book in English
 * in a Spanish answer ("Zechariah 12:10"), so each one is written out again.
 */
function appleRefs<T extends { ref: string }>(references: T[], locale: Locale): T[] {
  const seen = new Set<string>();
  return references.flatMap((r) => {
    const parsed = parseRef(r.ref);
    if (!parsed) return [];
    const verses = parsed.from ? `:${parsed.from}${parsed.to ? `-${parsed.to}` : ""}` : "";
    const ref = `${bookLabel(parsed.bookId, locale)} ${parsed.chapter}${verses}`;
    if (seen.has(ref)) return [];
    seen.add(ref);
    return [{ ...r, ref }];
  });
}

async function askApple({ question, locale, studyTitle, onPartial }: AskAiOptions): Promise<AiAnswer> {
  let last: Extract<AppleAiEvent, { type: "partial" }> | undefined;
  await new Promise<void>((resolve, reject) => {
    appleAi
      .respond({ instructions: buildAppleInstructions(locale, studyTitle), prompt: question }, (event) => {
        if (event.type === "partial") {
          last = event;
          onPartial?.(applePartial(event, locale));
        } else if (event.type === "completed") {
          resolve();
        } else {
          reject(new Error(describeAppleFailure(event.code, locale)));
        }
      })
      .catch((err: unknown) => reject(new Error(describeAppleFailure(err instanceof Error ? err.message : "", locale))));
  });
  const final = AiAnswerSchema.safeParse(
    last && { answer: last.answer, references: appleRefs(last.references, locale).map((r) => ({ ref: r.ref, why: r.why ?? "" })) }
  );
  if (!final.success || !final.data.answer.trim()) throw new Error(STR[locale].appleAiFailure.badFormat);
  return final.data;
}

/**
 * Streams the reply: `onPartial` gets the answer-so-far as each chunk
 * arrives, and the promise resolves with the complete, schema-validated
 * answer once the stream ends.
 */
export async function askAi(options: AskAiOptions): Promise<AiAnswer> {
  const { question, locale, choice, credential, studyTitle, onPartial } = options;
  if (choice.provider === "chatgpt") return askChatgpt(options);
  if (choice.provider === "apple") return askApple(options);
  if (!credential?.trim()) {
    throw new Error("No Anthropic API key configured. Add one in the key dialog.");
  }

  const anthropic = createAnthropic({
    apiKey: credential,
    fetch: tauriFetch as unknown as typeof globalThis.fetch,
    headers: { "anthropic-dangerous-direct-browser-access": "true" }
  });

  // partialOutputStream swallows errors and `output` rejects with a generic
  // "no output" one, so keep the original (it carries the status code and
  // Anthropic's message that describeAiError digs out).
  let streamError: unknown;
  const result = streamText({
    model: anthropic(choice.model),
    output: Output.object({ schema: AiAnswerSchema }),
    system: buildSystemPrompt(locale, studyTitle),
    prompt: question,
    onError: ({ error }) => {
      streamError = error;
    }
  });

  try {
    for await (const partial of result.partialOutputStream) onPartial?.(partialAnswer(partial));
    return await result.output;
  } catch (err) {
    throw new Error(describeAiError(streamError ?? err));
  }
}
