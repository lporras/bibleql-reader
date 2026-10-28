// Per-installation BibleQL credentials — see docs/installation-keys.md.
//
// Each install registers itself once (`registerInstallation`) and keeps the
// token it gets back in the OS credential store (platform/install.ts). No
// key is compiled into the app. Pure logic over injected dependencies, so
// the whole flow is unit-tested without a shell or a network.

export interface InstallIdentity {
  installationId: string;
  token: string | null;
}

export interface InstallStore {
  /** Creates and persists the installation id on first use. */
  get(): Promise<InstallIdentity>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

/** Calls `registerInstallation` and returns the new token. */
export type Register = (installationId: string) => Promise<string>;

export interface InstallationAuth {
  /** The stored token, registering first if there is none. */
  getToken(): Promise<string>;
  /**
   * Called after BibleQL rejected `rejected`: registers again (the server
   * revokes this installation's old token) unless another caller already
   * replaced it. Concurrent calls share one registration.
   */
  refreshToken(rejected: string): Promise<string>;
}

export function createInstallationAuth(store: InstallStore, register: Register): InstallationAuth {
  let current: string | null = null;
  let inFlight: Promise<string> | null = null;

  function load(forceRegister: boolean): Promise<string> {
    inFlight ??= (async () => {
      const identity = await store.get();
      if (identity.token && !forceRegister) return identity.token;
      if (forceRegister) await store.clear();
      const token = await register(identity.installationId);
      // A store that can't write still leaves a working token for this run;
      // the next launch registers again rather than starting without one.
      await store.set(token).catch(() => {});
      return token;
    })()
      .then((token) => {
        current = token;
        return token;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  return {
    getToken() {
      return current ? Promise.resolve(current) : load(false);
    },

    async refreshToken(rejected) {
      if (inFlight) {
        const token = await inFlight.catch(() => null);
        if (token && token !== rejected) return token;
      }
      if (current && current !== rejected) return current;
      current = null;
      return load(true);
    }
  };
}
