import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import type { Theme } from "../types/app";
import type { Locale } from "../data/strings";
import { readAiKey, readPrefs, writeAiKey, writePrefs } from "./persist";

const DEFAULT_TRANS_A = "eng-web";
const DEFAULT_TRANS_B = "spa-rv1909";

export interface AppState {
  theme: Theme;
  locale: Locale;
  compare: boolean;
  panelOpen: boolean;
  transA: string;
  transB: string;
  aiApiKey: string;
  keyDialogOpen: boolean;
}

type Action =
  | { type: "TOGGLE_THEME" }
  | { type: "TOGGLE_LOCALE" }
  | { type: "TOGGLE_COMPARE" }
  | { type: "TOGGLE_PANEL" }
  | { type: "SET_TRANS_A"; id: string }
  | { type: "SET_TRANS_B"; id: string }
  | { type: "SAVE_KEYS"; aiApiKey: string }
  | { type: "OPEN_KEY_DIALOG" }
  | { type: "CLOSE_KEY_DIALOG" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "TOGGLE_THEME":
      return { ...state, theme: state.theme === "dark" ? "light" : "dark" };
    case "TOGGLE_LOCALE":
      return { ...state, locale: state.locale === "es" ? "en" : "es" };
    case "TOGGLE_COMPARE":
      return { ...state, compare: !state.compare };
    case "TOGGLE_PANEL":
      return { ...state, panelOpen: !state.panelOpen };
    case "SET_TRANS_A":
      return { ...state, transA: action.id };
    case "SET_TRANS_B":
      return { ...state, transB: action.id };
    case "SAVE_KEYS":
      return { ...state, aiApiKey: action.aiApiKey, keyDialogOpen: false };
    case "OPEN_KEY_DIALOG":
      return { ...state, keyDialogOpen: true };
    case "CLOSE_KEY_DIALOG":
      return { ...state, keyDialogOpen: false };
    default:
      return state;
  }
}

function init(): AppState {
  const prefs = readPrefs();
  return {
    theme: prefs.theme ?? "light",
    locale: prefs.locale ?? "en",
    compare: prefs.compare ?? false,
    panelOpen: prefs.panelOpen ?? true,
    transA: prefs.transA ?? DEFAULT_TRANS_A,
    transB: prefs.transB ?? DEFAULT_TRANS_B,
    aiApiKey: readAiKey(),
    keyDialogOpen: false
  };
}

export interface AppStateActions {
  toggleTheme(): void;
  toggleLocale(): void;
  toggleCompare(): void;
  togglePanel(): void;
  setTransA(id: string): void;
  setTransB(id: string): void;
  saveKeys(aiApiKey: string): void;
  openKeyDialog(): void;
  closeKeyDialog(): void;
}

interface AppStateContextValue {
  state: AppState;
  actions: AppStateActions;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    writePrefs({
      theme: state.theme,
      locale: state.locale,
      compare: state.compare,
      panelOpen: state.panelOpen,
      transA: state.transA,
      transB: state.transB
    });
  }, [state.theme, state.locale, state.compare, state.panelOpen, state.transA, state.transB]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);

  const actions = useMemo<AppStateActions>(
    () => ({
      toggleTheme: () => dispatch({ type: "TOGGLE_THEME" }),
      toggleLocale: () => dispatch({ type: "TOGGLE_LOCALE" }),
      toggleCompare: () => dispatch({ type: "TOGGLE_COMPARE" }),
      togglePanel: () => dispatch({ type: "TOGGLE_PANEL" }),
      setTransA: (id: string) => dispatch({ type: "SET_TRANS_A", id }),
      setTransB: (id: string) => dispatch({ type: "SET_TRANS_B", id }),
      saveKeys: (aiApiKey: string) => {
        writeAiKey(aiApiKey);
        dispatch({ type: "SAVE_KEYS", aiApiKey });
      },
      openKeyDialog: () => dispatch({ type: "OPEN_KEY_DIALOG" }),
      closeKeyDialog: () => dispatch({ type: "CLOSE_KEY_DIALOG" })
    }),
    []
  );

  const value = useMemo<AppStateContextValue>(() => ({ state, actions }), [state, actions]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within an AppStateProvider");
  return ctx;
}
