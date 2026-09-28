import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "../data/strings";
import { isSpeechSupported, speakQueue, stopSpeaking } from "../lib/speech";

export interface SpeakableVerse {
  n: number;
  text: string;
}

// Single source of truth for read-aloud: starting anything cancels the rest
// (speechSynthesis has a single queue), the header button reflects `speaking`
// and the verse being read is exposed as `activeVerse` for highlighting.
export function useSpeech(locale: Locale): {
  speaking: boolean;
  activeVerse: number | null;
  supported: boolean;
  speakChapter: (verses: SpeakableVerse[]) => void;
  speakVerse: (n: number, text: string) => void;
  stop: () => void;
} {
  const [speaking, setSpeaking] = useState(false);
  const [activeVerse, setActiveVerse] = useState<number | null>(null);
  const supported = isSpeechSupported();
  // Guard against a stale onEnd from a previous queue resetting state that
  // belongs to a newer one (e.g. verse tapped mid-chapter).
  const runId = useRef(0);

  const stop = useCallback(() => {
    runId.current += 1;
    stopSpeaking();
    setSpeaking(false);
    setActiveVerse(null);
  }, []);

  const speakItems = useCallback(
    (verses: SpeakableVerse[]) => {
      const items = verses.filter((v) => v.text.trim().length > 0);
      if (items.length === 0) return;
      const id = runId.current + 1;
      runId.current = id;
      const isCurrent = (): boolean => runId.current === id;
      setSpeaking(true);
      setActiveVerse(items[0].n);
      speakQueue(
        items.map((v) => v.text),
        locale,
        {
          onItemStart: (i) => {
            if (isCurrent()) setActiveVerse(items[i].n);
          },
          onEnd: () => {
            if (isCurrent()) {
              setSpeaking(false);
              setActiveVerse(null);
            }
          }
        }
      );
    },
    [locale]
  );

  const speakChapter = useCallback((verses: SpeakableVerse[]) => speakItems(verses), [speakItems]);

  const speakVerse = useCallback(
    (n: number, text: string) => speakItems([{ n, text }]),
    [speakItems]
  );

  // Stop reading when the UI language changes mid-speech (the queued voice
  // would no longer match) and on unmount. Running on mount is harmless.
  useEffect(() => {
    stop();
  }, [locale, stop]);

  useEffect(() => () => stopSpeaking(), []);

  return { speaking, activeVerse, supported, speakChapter, speakVerse, stop };
}
