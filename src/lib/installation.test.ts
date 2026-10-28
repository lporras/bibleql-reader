import { describe, expect, it, vi } from "vitest";
import { createInstallationAuth, type InstallIdentity, type InstallStore } from "./installation";

// A fake credential store and a fake `registerInstallation` — no shell, no
// network.
function fakeStore(initial: InstallIdentity = { installationId: "id-1", token: null }) {
  const state = { ...initial };
  const store: InstallStore = {
    get: vi.fn(async () => ({ ...state })),
    set: vi.fn(async (token: string) => {
      state.token = token;
    }),
    clear: vi.fn(async () => {
      state.token = null;
    })
  };
  return { store, state };
}

function counterRegister() {
  let n = 0;
  return vi.fn(async (_installationId: string) => `token-${++n}`);
}

describe("createInstallationAuth", () => {
  it("registers on first launch and stores the token", async () => {
    const { store, state } = fakeStore();
    const register = counterRegister();
    const auth = createInstallationAuth(store, register);

    await expect(auth.getToken()).resolves.toBe("token-1");
    expect(register).toHaveBeenCalledWith("id-1");
    expect(state.token).toBe("token-1");
  });

  it("uses a stored token without registering", async () => {
    const { store } = fakeStore({ installationId: "id-1", token: "saved" });
    const register = counterRegister();
    const auth = createInstallationAuth(store, register);

    await expect(auth.getToken()).resolves.toBe("saved");
    expect(register).not.toHaveBeenCalled();
  });

  it("shares one registration between concurrent callers", async () => {
    const { store } = fakeStore();
    const register = counterRegister();
    const auth = createInstallationAuth(store, register);

    const tokens = await Promise.all([auth.getToken(), auth.getToken(), auth.getToken()]);
    expect(tokens).toEqual(["token-1", "token-1", "token-1"]);
    expect(register).toHaveBeenCalledTimes(1);
  });

  it("re-registers once after a rejection, even when several requests were rejected", async () => {
    const { store, state } = fakeStore({ installationId: "id-1", token: "revoked" });
    const register = counterRegister();
    const auth = createInstallationAuth(store, register);
    await auth.getToken();

    const tokens = await Promise.all([auth.refreshToken("revoked"), auth.refreshToken("revoked")]);
    expect(tokens).toEqual(["token-1", "token-1"]);
    expect(register).toHaveBeenCalledTimes(1);
    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(state.token).toBe("token-1");
  });

  it("doesn't re-register for a token that was already replaced", async () => {
    const { store } = fakeStore({ installationId: "id-1", token: "revoked" });
    const register = counterRegister();
    const auth = createInstallationAuth(store, register);
    await auth.refreshToken("revoked");

    // A late 401 for the old token arrives after the refresh finished.
    await expect(auth.refreshToken("revoked")).resolves.toBe("token-1");
    expect(register).toHaveBeenCalledTimes(1);
  });

  it("lets the next call retry after a failed registration", async () => {
    const { store } = fakeStore();
    const register = vi
      .fn<(id: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("token-2");
    const auth = createInstallationAuth(store, register);

    await expect(auth.getToken()).rejects.toThrow("offline");
    await expect(auth.getToken()).resolves.toBe("token-2");
    expect(register).toHaveBeenCalledTimes(2);
  });

  it("keeps a working token for this run when the store can't save it", async () => {
    const { store } = fakeStore();
    store.set = vi.fn(async () => {
      throw new Error("keychain locked");
    });
    const auth = createInstallationAuth(store, counterRegister());

    await expect(auth.getToken()).resolves.toBe("token-1");
    await expect(auth.getToken()).resolves.toBe("token-1");
  });
});
