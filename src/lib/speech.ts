import type { Locale } from "../data/strings";

// Read-aloud via the Web Speech API (no keys or network needed — it uses
// the OS voices). The voice follows the app UI locale.

const LANG: Record<Locale, string> = { en: "en-US", es: "es-ES" };

let replacementVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(locale: Locale): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const prefix = LANG[locale].slice(0, 2);
  const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  if (matching.length === 0) return null;
  // macOS "Alex" sounds robotic, so prefer a natural voice when Alex is
  // the default.
  if (locale === "en") {
    const defaultVoice = matching.find((v) => v.default);
    if (!defaultVoice || !defaultVoice.name.toLowerCase().includes("alex")) return defaultVoice ?? null;
    const preferred = ["samantha", "siri", "daniel", "karen"];
    for (const pref of preferred) {
      const match = matching.find(
        (v) => v.name.toLowerCase().includes(pref) && !v.name.toLowerCase().includes("alex")
      );
      if (match) return match;
    }
    return null;
  }
  return matching.find((v) => v.default) ?? matching[0] ?? null;
}

function getVoice(locale: Locale): SpeechSynthesisVoice | null {
  if (replacementVoice !== undefined && locale === "en") return replacementVoice;
  const voice = pickVoice(locale);
  if (locale === "en") replacementVoice = voice;
  return voice;
}

// Pre-load voices so they're cached before first use.
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    replacementVoice = undefined;
  });
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speakText(text: string, locale: Locale, onend?: () => void): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = LANG[locale];
  utter.rate = 0.9;
  const voice = getVoice(locale);
  if (voice) utter.voice = voice;
  if (onend) {
    utter.onend = onend;
    utter.onerror = onend;
  }
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking(): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
}

export interface SpeakCallbacks {
  onItemStart?: (index: number) => void;
  onEnd?: () => void;
}

// Queue one utterance per item (e.g. one per verse) instead of a single
// utterance for the whole text. Each utterance's `onstart` tells us exactly
// which item is being read, so the UI can highlight it — more reliable than
// `onboundary` char offsets, which browsers report inconsistently.
export function speakQueue(texts: string[], locale: Locale, callbacks?: SpeakCallbacks): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
  if (texts.length === 0) {
    callbacks?.onEnd?.();
    return;
  }
  const voice = getVoice(locale);
  const abort = (): void => {
    window.speechSynthesis.cancel();
    callbacks?.onEnd?.();
  };
  texts.forEach((text, i) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = LANG[locale];
    utter.rate = 0.9;
    if (voice) utter.voice = voice;
    utter.onstart = () => callbacks?.onItemStart?.(i);
    utter.onerror = abort;
    if (i === texts.length - 1) utter.onend = () => callbacks?.onEnd?.();
    window.speechSynthesis.speak(utter);
  });
}
