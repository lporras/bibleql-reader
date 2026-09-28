import { useViewportWidth } from "./useViewportWidth";

export interface ResponsiveLayout {
  vw: number;
  panelEff: boolean;
  showSidebar: boolean;
  compareEff: boolean;
}

// The window is resizable, so the chrome yields before the text measure does:
// the study panel folds first, then compare, then the book sidebar.
export function useResponsiveLayout(panelOpen: boolean, compare: boolean): ResponsiveLayout {
  const vw = useViewportWidth();
  const panelEff = panelOpen && vw >= 760;
  const showSidebar = vw >= (panelEff ? 1180 : 820);
  const compareEff = compare && vw >= (panelEff ? 1320 : 860);
  return { vw, panelEff, showSidebar, compareEff };
}
