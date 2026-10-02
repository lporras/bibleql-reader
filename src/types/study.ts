// A Study is what a preacher builds a sermon or a lesson in: a title, a
// rich-text body (sermon notes, outline, application) and the passages
// collected for it — from a verse selection in the reader or from the AI
// assistant's recommendations.
//
// Passages are stored by book id + chapter + verse numbers, never by a
// pre-formatted reference string, so the reference re-renders in whichever
// locale the app is in (same rule as the Image Creator's BibleSource).

export type PassageSource = "reader" | "ai";

export interface StudyPassage {
  id: string;
  bookId: string;
  chapter: number;
  /** Sorted, possibly non-contiguous. Empty means the whole chapter. */
  verses: number[];
  translationId: string;
  /**
   * Snapshot of the verse text, so the study (and its PDF) doesn't need the
   * network to show it. Empty until fetched — an AI-recommended passage
   * arrives as a bare reference and is filled in by the study views.
   */
  text: string;
  source: PassageSource;
  /** Why the assistant recommended it; empty for reader selections. */
  why: string;
  addedAt: number;
}

export interface Study {
  id: string;
  title: string;
  /** HTML from the study editor (TipTap), limited to what the PDF lays out. */
  descriptionHtml: string;
  passages: StudyPassage[];
  createdAt: number;
  updatedAt: number;
}

export interface StudiesState {
  studies: Study[];
  /** The study that "Add to study" sends verses to. */
  activeId: string | null;
}
