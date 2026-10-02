import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { emptyStudy, studiesReducer } from "./study";
import { readStudies, writeStudies } from "./persist";
import { pruneStudyImages } from "./studyImages";
import { newId } from "../lib/id";
import type { StudiesState, Study, StudyPassage } from "../types/study";

export type NewPassage = Omit<StudyPassage, "id" | "addedAt">;

export interface StudiesActions {
  /**
   * Creates a study, makes it the active one, and returns its id. It starts
   * untitled — an empty title, so the title field shows its placeholder
   * rather than text the preacher has to delete first.
   */
  create(): string;
  update(id: string, patch: Partial<Pick<Study, "title" | "descriptionHtml">>): void;
  remove(id: string): void;
  setActive(id: string): void;
  /**
   * Sends passages to the active study — or to a new, untitled one when
   * there is none yet, so the first "Add to study" never needs a separate
   * "create" step. Returns the study id used.
   */
  addToActive(passages: NewPassage[]): string;
  removePassage(id: string, passageId: string): void;
  movePassage(id: string, passageId: string, dir: 1 | -1): void;
  setPassageText(id: string, passageId: string, text: string): void;
}

interface StudiesContextValue {
  studies: Study[];
  active: Study | null;
  actions: StudiesActions;
}

// The study body is written on every keystroke, and the whole store is one
// JSON blob — so coalesce bursts of edits into one write, and flush whatever
// is pending if the window goes away mid-burst.
const WRITE_DELAY_MS = 300;

const StudiesContext = createContext<StudiesContextValue | null>(null);

export function StudiesProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, dispatch] = useReducer(studiesReducer, undefined, readStudies);

  // addToActive has to know whether a study is active *now*, while the
  // actions object stays referentially stable (it's memoized once, like
  // AnnotationsContext's). A ref gives it the latest state without that.
  const stateRef = useRef<StudiesState>(state);
  stateRef.current = state;

  useEffect(() => {
    const timer = window.setTimeout(() => writeStudies(state), WRITE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  // Images deleted from a body (or with their study) stay in IndexedDB
  // until the next launch: undo can bring a removed image back for as long
  // as the session lasts, and the undo history doesn't outlive it.
  useEffect(() => {
    void pruneStudyImages(stateRef.current.studies);
  }, []);

  useEffect(() => {
    const flush = (): void => writeStudies(stateRef.current);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const actions = useMemo<StudiesActions>(() => {
    function create(): string {
      const id = newId();
      dispatch({ type: "CREATE", study: emptyStudy(id, "", Date.now()) });
      return id;
    }
    return {
      create,
      update: (id, patch) => dispatch({ type: "UPDATE", id, patch, now: Date.now() }),
      remove: (id) => dispatch({ type: "DELETE", id }),
      setActive: (id) => dispatch({ type: "SET_ACTIVE", id }),
      addToActive: (passages) => {
        const id = stateRef.current.activeId ?? create();
        const now = Date.now();
        dispatch({
          type: "ADD_PASSAGES",
          id,
          passages: passages.map((p) => ({ ...p, id: newId(), addedAt: now })),
          now
        });
        return id;
      },
      removePassage: (id, passageId) => dispatch({ type: "REMOVE_PASSAGE", id, passageId, now: Date.now() }),
      movePassage: (id, passageId, dir) => dispatch({ type: "MOVE_PASSAGE", id, passageId, dir, now: Date.now() }),
      setPassageText: (id, passageId, text) => dispatch({ type: "SET_PASSAGE_TEXT", id, passageId, text })
    };
  }, []);

  const value = useMemo<StudiesContextValue>(
    () => ({
      studies: state.studies,
      active: state.studies.find((s) => s.id === state.activeId) ?? null,
      actions
    }),
    [state, actions]
  );

  return <StudiesContext.Provider value={value}>{children}</StudiesContext.Provider>;
}

export function useStudies(): StudiesContextValue {
  const ctx = useContext(StudiesContext);
  if (!ctx) throw new Error("useStudies must be used within a StudiesProvider");
  return ctx;
}
