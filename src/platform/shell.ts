import { invoke } from "@tauri-apps/api/core";

// The app's own Rust commands (src-tauri/src) are only there inside a Tauri
// shell. `yarn dev` in a browser has none; the E2E suite's stub
// `__TAURI_INTERNALS__` counts as one, so specs can answer the commands
// themselves. Checked per call, never at module scope.
export function hasShell(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Rust returns its errors as plain strings; give callers real Errors.
export async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}
