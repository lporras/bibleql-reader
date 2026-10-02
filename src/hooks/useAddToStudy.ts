import { useCallback } from "react";
import { useAppState } from "../state/AppStateContext";
import { useStudies } from "../state/StudiesContext";
import { hasPassage, versesFromRange } from "../state/study";
import { parseRef } from "../lib/refs";
import type { PassageSource, Study } from "../types/study";

export interface PassageDraft {
  bookId: string;
  chapter: number;
  verses: number[];
  text?: string;
  source: PassageSource;
  why?: string;
}

export interface AddToStudyApi {
  /** The study passages go to; null until the first one is created. */
  active: Study | null;
  /** Already in the active study *in the current translation*. */
  has(draft: Pick<PassageDraft, "bookId" | "chapter" | "verses">): boolean;
  add(draft: PassageDraft): void;
  /** An assistant reference ("Juan 3:16-17") as a draft, or null if it doesn't parse. */
  fromRef(text: string, why: string): PassageDraft | null;
}

// Shared by the reader's verse toolbar and the assistant's reference chips —
// both just hand over a book/chapter/verses and let the active study (or a
// freshly created one) take it. The passage is stamped with the primary
// translation, so a reference the assistant suggested is later fetched in
// the same translation the reader is reading.
export function useAddToStudy(): AddToStudyApi {
  const { state } = useAppState();
  const { active, actions } = useStudies();
  const translationId = state.transA;

  // Asked about the translation being read: switching translations turns
  // "In study" back into "Add to study", for the same verses in the new one.
  const has = useCallback<AddToStudyApi["has"]>(
    (draft) => hasPassage(active, { ...draft, translationId }),
    [active, translationId]
  );

  const add = useCallback<AddToStudyApi["add"]>(
    (draft) => {
      actions.addToActive(
        [
          {
            bookId: draft.bookId,
            chapter: draft.chapter,
            verses: draft.verses,
            translationId,
            text: draft.text ?? "",
            source: draft.source,
            why: draft.why ?? ""
          }
        ]
      );
    },
    [actions, translationId]
  );

  const fromRef = useCallback<AddToStudyApi["fromRef"]>((text, why) => {
    const parsed = parseRef(text);
    if (!parsed) return null;
    return {
      bookId: parsed.bookId,
      chapter: parsed.chapter,
      verses: versesFromRange(parsed.from, parsed.to),
      source: "ai",
      why
    };
  }, []);

  return { active, has, add, fromRef };
}
