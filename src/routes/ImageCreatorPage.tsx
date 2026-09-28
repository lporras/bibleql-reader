import { useEffect, useReducer, useRef, type JSX } from "react";
import { useSearchParams } from "react-router-dom";
import { useAppState } from "../state/AppStateContext";
import { usePassage } from "../queries/usePassage";
import { decodeVerses } from "../lib/verseRanges";
import { buildReference, buildScriptureText } from "../features/image-creator/lib/scriptureText";
import { createDefaultProject } from "../features/image-creator/model/defaults";
import { imageCreatorReducer } from "../features/image-creator/state/reducer";
import type { BibleSource } from "../features/image-creator/model/types";
import { CreatorTopBar } from "../features/image-creator/components/CreatorTopBar";
import { BackgroundPanel } from "../features/image-creator/components/BackgroundPanel";
import { ScripturePanel } from "../features/image-creator/components/ScripturePanel";
import { PropertiesPanel } from "../features/image-creator/components/PropertiesPanel";
import { EditorCanvas } from "../features/image-creator/components/EditorCanvas";
import styles from "./ImageCreatorPage.module.scss";

export function ImageCreatorPage(): JSX.Element {
  const { state } = useAppState();
  const [searchParams] = useSearchParams();

  const translationId = searchParams.get("t") ?? "";
  const bookId = searchParams.get("b") ?? "";
  const chapter = Number(searchParams.get("c") ?? 0);
  const verses = decodeVerses(searchParams.get("v") ?? "");
  const hasSelection = Boolean(translationId && bookId && chapter && verses.length > 0);

  const passage = usePassage("a", translationId, bookId, chapter, hasSelection);

  const [editorState, dispatch] = useReducer(imageCreatorReducer, undefined, () => ({
    project: createDefaultProject(),
    selectedElementId: null,
    isDirty: false
  }));

  // Passage data arrives asynchronously (react-query), so the project is
  // (re)initialized once when it's ready rather than built synchronously
  // from the URL — this also degrades cleanly to an empty project (Flow B)
  // when there's no selection to hand off at all.
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    if (!hasSelection) {
      initialized.current = true;
      return;
    }
    if (!passage.data) return;

    const reference = buildReference(bookId, chapter, verses, state.locale);
    const bibleSource: BibleSource = { translationId, bookId, chapter, verses, reference };
    const scriptureText = buildScriptureText(passage.data.verses, verses);

    dispatch({ type: "REPLACE_PROJECT", project: createDefaultProject(bibleSource, scriptureText) });
    initialized.current = true;
    // Deliberately keyed on passage.data only — the `initialized` guard
    // makes this run exactly once, so re-running on every render of the
    // other (stable, URL-derived) values above would add nothing.
  }, [passage.data]);

  const selectedElement = editorState.project.elements.find((el) => el.id === editorState.selectedElementId) ?? null;

  return (
    <div className={styles.shell}>
      <CreatorTopBar
        locale={state.locale}
        project={editorState.project}
        onChangeCanvas={(canvas) => dispatch({ type: "SET_CANVAS", canvas })}
      />

      <div className={styles.body}>
        <div className={styles.leftPanel}>
          <BackgroundPanel
            locale={state.locale}
            background={editorState.project.background}
            onChangeBackground={(background) => dispatch({ type: "SET_BACKGROUND", background })}
            onChangeCrop={(crop) => dispatch({ type: "SET_CROP", crop })}
            onChangeOverlay={(overlay) => dispatch({ type: "SET_OVERLAY", overlay })}
          />
          <ScripturePanel locale={state.locale} bibleSource={editorState.project.bibleSource} />
        </div>

        <EditorCanvas
          project={editorState.project}
          selectedElementId={editorState.selectedElementId}
          onSelectElement={(id) => dispatch({ type: "SELECT_ELEMENT", id })}
          onMoveElement={(id, x, y) => dispatch({ type: "MOVE_ELEMENT", id, x, y })}
          onResizeElement={(id, width) => dispatch({ type: "RESIZE_ELEMENT", id, width })}
          onChangeElementText={(id, text) => dispatch({ type: "UPDATE_ELEMENT", id, patch: { text } })}
        />

        <div className={styles.rightPanel}>
          <PropertiesPanel
            locale={state.locale}
            element={selectedElement}
            onUpdate={(patch) => {
              if (editorState.selectedElementId) {
                dispatch({ type: "UPDATE_ELEMENT", id: editorState.selectedElementId, patch });
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
