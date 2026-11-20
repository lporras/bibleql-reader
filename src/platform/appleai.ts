import { Channel } from "@tauri-apps/api/core";
import { call, hasShell } from "./shell";
import type { AppleAiEvent, AppleAiStatus } from "../types/ai";

// Apple Intelligence: the seam to src-tauri/plugins/tauri-plugin-appleai, which
// runs Apple's on-device model (Foundation Models, iOS/iPadOS/macOS 26+).
// Nothing goes over the network. See docs/apple-intelligence.md.
//
// Outside a Tauri shell there is no model; the provider is hidden there anyway
// (APPLE_AI_SUPPORTED in platform/host.ts).

const STATUSES: ReadonlySet<AppleAiStatus> = new Set<AppleAiStatus>([
  "available",
  "deviceNotEligible",
  "appleIntelligenceNotEnabled",
  "modelNotReady",
  "unsupportedLocale",
  "unsupportedOS",
  "unavailable"
]);

export const appleAi = {
  /** Whether the model can answer in `locale` right now, or why not. */
  async availability(locale: string): Promise<AppleAiStatus> {
    if (!hasShell()) return "unsupportedOS";
    const status = await call<string | null>("plugin:appleai|availability", { locale });
    return status && STATUSES.has(status as AppleAiStatus) ? (status as AppleAiStatus) : "unavailable";
  },
  /**
   * Streams one reply. Rejects if it couldn't start; once started, the reply
   * always ends on a `completed` or `failed` event.
   */
  async respond(request: { instructions: string; prompt: string }, onEvent: (event: AppleAiEvent) => void): Promise<void> {
    const channel = new Channel<AppleAiEvent>();
    channel.onmessage = onEvent;
    await call("plugin:appleai|respond", { ...request, onEvent: channel });
  }
};
