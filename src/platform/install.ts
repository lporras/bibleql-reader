import { call, hasShell } from "./shell";
import type { InstallStore, InstallIdentity } from "../lib/installation";

// The per-installation BibleQL token: the seam to src-tauri/src/install.rs,
// which keeps it in the OS credential store (never localStorage). See
// docs/installation-keys.md.
//
// Outside a Tauri shell (`yarn dev` in a browser) both the id and the token
// live in memory for the page's lifetime, so a dev session registers a real
// installation of its own. No key is bundled for it.
let memory: InstallIdentity | null = null;

function memoryIdentity(): InstallIdentity {
  memory ??= { installationId: crypto.randomUUID(), token: null };
  return memory;
}

export const installStore: InstallStore = {
  async get() {
    if (!hasShell()) return { ...memoryIdentity() };
    return call<InstallIdentity>("get_install_token");
  },
  async set(token) {
    if (!hasShell()) {
      memoryIdentity().token = token;
      return;
    }
    await call("set_install_token", { token });
  },
  async clear() {
    if (!hasShell()) {
      memoryIdentity().token = null;
      return;
    }
    await call("clear_install_token");
  }
};
