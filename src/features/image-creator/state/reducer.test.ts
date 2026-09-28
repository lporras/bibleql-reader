import { describe, expect, it } from "vitest";
import { createDefaultProject, createDefaultReferenceElement } from "../model/defaults";
import { imageCreatorReducer, type ImageCreatorState } from "./reducer";

function initialState(): ImageCreatorState {
  return { project: createDefaultProject(), selectedElementId: null, isDirty: false };
}

describe("imageCreatorReducer", () => {
  it("moves an element and marks the project dirty", () => {
    const base = initialState();
    const element = { ...createDefaultReferenceElement("test"), id: "el-1", x: 0.1, y: 0.1 };
    const state: ImageCreatorState = { ...base, project: { ...base.project, elements: [element] } };

    const next = imageCreatorReducer(state, { type: "MOVE_ELEMENT", id: "el-1", x: 0.3, y: 0.4 });

    expect(next.isDirty).toBe(true);
    expect(next.project.elements[0]).toMatchObject({ x: 0.3, y: 0.4 });
  });

  it("leaves other elements untouched when updating one by id", () => {
    const base = initialState();
    const state: ImageCreatorState = {
      ...base,
      project: {
        ...base.project,
        elements: [
          { ...createDefaultReferenceElement("test"), id: "a", color: "#000000" },
          { ...createDefaultReferenceElement("test"), id: "b", color: "#ffffff" }
        ]
      }
    };

    const next = imageCreatorReducer(state, { type: "UPDATE_ELEMENT", id: "a", patch: { color: "#ff0000" } });

    expect(next.project.elements.find((e) => e.id === "a")?.color).toBe("#ff0000");
    expect(next.project.elements.find((e) => e.id === "b")?.color).toBe("#ffffff");
  });

  it("replaces the project and resets dirty/selection", () => {
    const state = initialState();
    const fresh = createDefaultProject();
    const next = imageCreatorReducer({ ...state, isDirty: true, selectedElementId: "x" }, { type: "REPLACE_PROJECT", project: fresh });

    expect(next.project).toBe(fresh);
    expect(next.isDirty).toBe(false);
    expect(next.selectedElementId).toBeNull();
  });

  it("SET_CROP is a no-op when there's no background", () => {
    const state = initialState();
    const next = imageCreatorReducer(state, { type: "SET_CROP", crop: { x: 0, y: 0, scale: 1 } });
    expect(next).toBe(state);
  });
});
