import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { offlineBible } from "../platform/offline";
import { queryKeys } from "../queries/keys";
import type { InstallProgress, InstalledTranslation, OfflinePackageInfo } from "../types/offline";

// In-flight offline downloads, keyed by translation id. Lives above the
// routes so a download keeps reporting progress when the sidebar unmounts
// (it folds away as the window narrows). Installed translations themselves
// are server-ish state and live in TanStack Query (useOfflineInstalled).

export type DownloadState =
  | { status: "downloading"; progress: InstallProgress | null }
  | { status: "removing" }
  | { status: "error"; message: string };

type Downloads = Record<string, DownloadState>;

type Action = { type: "SET"; id: string; state: DownloadState } | { type: "CLEAR"; id: string };

function reducer(state: Downloads, action: Action): Downloads {
  if (action.type === "SET") return { ...state, [action.id]: action.state };
  if (!(action.id in state)) return state;
  const next = { ...state };
  delete next[action.id];
  return next;
}

export interface OfflineDownloadsValue {
  downloads: Downloads;
  download(identifier: string, pkg: OfflinePackageInfo): Promise<void>;
  cancel(identifier: string): void;
  remove(identifier: string): Promise<void>;
  dismiss(identifier: string): void;
}

const OfflineDownloadsContext = createContext<OfflineDownloadsValue | null>(null);

// Every query keyed on the translation id ([kind, translationId, ...]) — the
// next read goes to the newly installed package, or back to the network.
function invalidateTranslation(queryClient: QueryClient, identifier: string): Promise<void> {
  return queryClient.invalidateQueries({ predicate: (q) => q.queryKey[1] === identifier });
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function OfflineDownloadsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const queryClient = useQueryClient();
  const [downloads, dispatch] = useReducer(reducer, {});

  const setInstalled = useCallback(
    (update: (list: InstalledTranslation[]) => InstalledTranslation[]) =>
      queryClient.setQueryData<InstalledTranslation[]>(queryKeys.offlineInstalled(), (list) => update(list ?? [])),
    [queryClient]
  );

  const download = useCallback(
    async (identifier: string, pkg: OfflinePackageInfo) => {
      dispatch({ type: "SET", id: identifier, state: { status: "downloading", progress: null } });
      try {
        const installed = await offlineBible.install(identifier, pkg, (progress) =>
          dispatch({ type: "SET", id: identifier, state: { status: "downloading", progress } })
        );
        setInstalled((list) => [...list.filter((t) => t.identifier !== identifier), installed]);
        dispatch({ type: "CLEAR", id: identifier });
        await invalidateTranslation(queryClient, identifier);
      } catch (err) {
        const message = errorMessage(err);
        if (message === "cancelled") dispatch({ type: "CLEAR", id: identifier });
        else dispatch({ type: "SET", id: identifier, state: { status: "error", message } });
      }
    },
    [queryClient, setInstalled]
  );

  const cancel = useCallback((identifier: string) => {
    void offlineBible.cancel(identifier);
  }, []);

  const remove = useCallback(
    async (identifier: string) => {
      dispatch({ type: "SET", id: identifier, state: { status: "removing" } });
      try {
        await offlineBible.remove(identifier);
        setInstalled((list) => list.filter((t) => t.identifier !== identifier));
        dispatch({ type: "CLEAR", id: identifier });
        await invalidateTranslation(queryClient, identifier);
      } catch (err) {
        dispatch({ type: "SET", id: identifier, state: { status: "error", message: errorMessage(err) } });
      }
    },
    [queryClient, setInstalled]
  );

  const dismiss = useCallback((identifier: string) => dispatch({ type: "CLEAR", id: identifier }), []);

  const value = useMemo(
    () => ({ downloads, download, cancel, remove, dismiss }),
    [downloads, download, cancel, remove, dismiss]
  );
  return <OfflineDownloadsContext.Provider value={value}>{children}</OfflineDownloadsContext.Provider>;
}

export function useOfflineDownloads(): OfflineDownloadsValue {
  const ctx = useContext(OfflineDownloadsContext);
  if (!ctx) throw new Error("useOfflineDownloads must be used inside OfflineDownloadsProvider");
  return ctx;
}
