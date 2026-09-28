import type {
  Background,
  BackgroundCrop,
  BackgroundOverlay,
  CanvasSettings,
  ImageCreatorProject,
  TextElement
} from "../model/types";

export interface ImageCreatorState {
  project: ImageCreatorProject;
  selectedElementId: string | null;
  isDirty: boolean;
}

// Each action below is deliberately one undoable operation (spec §19) —
// even though history isn't implemented in this slice, shaping the
// reducer this way now means adding undo/redo later is wrapping this
// reducer, not rewriting it.
export type ImageCreatorAction =
  | { type: "REPLACE_PROJECT"; project: ImageCreatorProject }
  | { type: "SET_BACKGROUND"; background: Background }
  | { type: "SET_CROP"; crop: BackgroundCrop }
  | { type: "SET_OVERLAY"; overlay: BackgroundOverlay }
  | { type: "SET_CANVAS"; canvas: CanvasSettings }
  | { type: "SELECT_ELEMENT"; id: string | null }
  | { type: "MOVE_ELEMENT"; id: string; x: number; y: number }
  | { type: "RESIZE_ELEMENT"; id: string; width: number }
  | { type: "UPDATE_ELEMENT"; id: string; patch: Partial<TextElement> };

function touch(project: ImageCreatorProject): ImageCreatorProject {
  return { ...project, updatedAt: new Date().toISOString() };
}

function updateElement(project: ImageCreatorProject, id: string, patch: Partial<TextElement>): ImageCreatorProject {
  return {
    ...project,
    elements: project.elements.map((el) => (el.id === id ? { ...el, ...patch } : el))
  };
}

export function imageCreatorReducer(state: ImageCreatorState, action: ImageCreatorAction): ImageCreatorState {
  switch (action.type) {
    case "REPLACE_PROJECT":
      return { project: action.project, selectedElementId: null, isDirty: false };

    case "SET_BACKGROUND":
      return { ...state, project: touch({ ...state.project, background: action.background }), isDirty: true };

    case "SET_CROP": {
      if (!state.project.background) return state;
      const background = { ...state.project.background, crop: action.crop };
      return { ...state, project: touch({ ...state.project, background }), isDirty: true };
    }

    case "SET_OVERLAY": {
      if (!state.project.background) return state;
      const background = { ...state.project.background, overlay: action.overlay };
      return { ...state, project: touch({ ...state.project, background }), isDirty: true };
    }

    case "SET_CANVAS":
      return { ...state, project: touch({ ...state.project, canvas: action.canvas }), isDirty: true };

    case "SELECT_ELEMENT":
      return { ...state, selectedElementId: action.id };

    case "MOVE_ELEMENT":
      return {
        ...state,
        project: touch(updateElement(state.project, action.id, { x: action.x, y: action.y })),
        isDirty: true
      };

    case "RESIZE_ELEMENT":
      return {
        ...state,
        project: touch(updateElement(state.project, action.id, { width: action.width })),
        isDirty: true
      };

    case "UPDATE_ELEMENT":
      return {
        ...state,
        project: touch(updateElement(state.project, action.id, action.patch)),
        isDirty: true
      };

    default:
      return state;
  }
}
