import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { generateObject, NoObjectGeneratedError } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import type { AiAnswer } from "../types/ai";

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

function buildSystemPrompt(locale: "en" | "es"): string {
  const es = locale === "es";
  return (
    "You are a careful Bible study assistant inside a Bible reading app. Answer in " +
    (es ? "Spanish" : "English") +
    ". Be concise (120 words maximum), grounded in the biblical text, and note when " +
    "faithful traditions read a passage differently instead of asserting one view. Reply with structured data: " +
    "an answer and 2 to 5 references. Each reference's `ref` must be a plain reference like " +
    `"${es ? "Mateo 18:21-22" : "Matthew 18:21-22"}" using ${es ? "Spanish" : "English"} book names.`
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
  if (NoObjectGeneratedError.isInstance(err)) {
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

export async function askAi(
  question: string,
  locale: "en" | "es",
  anthropicApiKey: string
): Promise<AiAnswer> {
  if (!anthropicApiKey?.trim()) {
    throw new Error("No Anthropic API key configured. Add one in the key dialog.");
  }

  const anthropic = createAnthropic({
    apiKey: anthropicApiKey,
    fetch: tauriFetch as unknown as typeof globalThis.fetch,
    headers: { "anthropic-dangerous-direct-browser-access": "true" }
  });

  try {
    const { object } = await generateObject({
      model: anthropic("claude-sonnet-5"),
      schema: AiAnswerSchema,
      system: buildSystemPrompt(locale),
      prompt: question
    });
    return object;
  } catch (err) {
    throw new Error(describeAiError(err));
  }
}
