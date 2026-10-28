# Installation keys

Every copy of the app gets its own BibleQL token. The token is issued the first time the app
launches and is stored in the operating system's credential store. No API key is compiled into
the app. The Unsplash key isn't either: background search goes through BibleQL, which keeps that
key on the server (see [unsplash.md](unsplash.md)).

Older releases compiled one shared `BIBLEQL_API_KEY` into every build. The server now marks that
key `deprecated`, and those releases show an update banner (see below).

## Flow

```
launch ─▶ get_install_token (Rust) ─▶ token stored? ──yes──▶ use it
                                        │
                                        no
                                        ▼
            registerInstallation(installationId, platform, appVersion)   ← no Authorization header
                                        │
                                        ▼
                         set_install_token (Rust) ─▶ use it
```

- **`src/lib/installation.ts`** — `createInstallationAuth`: the logic itself, written against an
  injected store and register function. `getToken()` returns the stored token, or registers
  first if there is none. `refreshToken(rejected)` registers again after a 401. Concurrent callers
  share a single registration in both cases.
- **`src/lib/graphqlClient.ts`** — the transport. Every request carries
  `Authorization: Bearer <token>` and `X-App-Version`. On `UNAUTHENTICATED` (HTTP 401) it calls
  `refreshToken` and retries **once**; a second 401 is thrown, never retried in a loop.
  - It maps HTTP 429 to a `RATE_LIMITED` error and keeps the server's `retryAfter`.
  - It reports `extensions.updateRequired` to the update banner.
- **`src/lib/graphql.ts`** — wires these two together. Its `gqlRequest` is what the query hooks call.
- **`src/queries/useInstallation.ts`** — registration as server state (`ready` / `pending` /
  `failed`). Every remote query waits until it is `ready`. If registration fails (offline, or
  rate-limited — the server allows 10 registrations per hour per IP), the reader shows its bundled
  Psalm 23 sample. It retries on reconnect and once a minute.
- **`src/platform/install.ts`** — the seam to Rust: the `get_install_token`, `set_install_token`
  and `clear_install_token` commands. These are app commands, so they need no capability entry.
- **`src-tauri/src/install.rs`** — the storage.

Registering again with the same installation id makes the server revoke the old token. The id is
created once and never changes, so a reinstall that keeps the credential store reuses it.

## Where the token lives

| Platform | Store | Crate |
|---|---|---|
| macOS | The fallback file (see below) | — |
| iOS / iPadOS | Data-protection keychain | `apple-native-keyring-store` (`protected`) |
| Windows | Credential Manager | `windows-native-keyring-store` |
| Linux | Secret Service (GNOME Keyring, KWallet…) over D-Bus | `zbus-secret-service-keyring-store` (pure Rust, no libdbus) |
| Android | SharedPreferences encrypted with an Android Keystore key | `android-native-keyring-store` |

These crates sit on `keyring-core`. The `keyring` umbrella crate's simple mode doesn't cover
iOS or Android, which is why the app links them directly. The Android store needs `ndk-context`,
which Tauri's Android runtime initializes.

**Fallback.** If the credential store can't be reached, `install.rs` keeps the id and token in
`<app data>/installation.json` instead. The file is created with mode 0600, so only the owner
can read it. One case where this happens is a Linux desktop with no Secret Service daemon
running. This fallback is weaker than a keychain, because any process running as the same user
can read the file. It exists because the alternative is worse: if storage failed, the app would
register again on every launch, revoking the previous token each time and using up the
per-IP registration limit.

**Why macOS doesn't use the Keychain.** The login keychain lets an item be read without a
prompt only by the app that created it, identified by its code signature. Release builds are
ad-hoc signed (there is no Developer ID), and an ad-hoc signature changes with every build. So
after each update, macOS would ask for the login keychain password before giving the token back.
Once releases are signed with a Developer ID, the signature stays stable across updates and the
Keychain store can come back. To do that, re-add `apple-native-keyring-store` (`keychain`) for
macOS and restore its line in `init_native_store`.

The token is never written to `localStorage`.

## Browser-only (`yarn dev`)

Without a Tauri shell there is no credential store. `platform/install.ts` keeps the id and token
in memory instead, so each page load registers once as a real installation (platform guessed
from the user agent). No dev key is bundled, so there is nothing to strip from release builds.

## Update banner

The server adds `extensions: { updateRequired, message, updateUrl }` to responses for a
deprecated key. `components/UpdateBanner.tsx` shows the message with a link, without blocking
the app. The banner can be dismissed for the session.

## Keeping keys out of the bundle

`yarn build` ends with `scripts/check-bundle-secrets.mjs`. The script fails the build if `dist/`
contains any of the following:

- a `bql_live_` / `bql_test_` token
- an Unsplash `Client-ID` header
- a call to `api.unsplash.com`
- the literal value of a `BIBLEQL_API_KEY` / `UNSPLASH_ACCESS_KEY` still set in the environment

`tauri build` runs `yarn build` (`beforeBuildCommand`), so release builds are covered.

## Tests

- **Unit tests** (`lib/installation.test.ts`, `lib/graphqlClient.test.ts`) cover:
  - registering on first launch
  - reusing a stored token
  - sharing one registration between concurrent callers
  - refreshing only once
  - retrying after a failed registration
  - retrying exactly once after a 401
  - 429 → `RATE_LIMITED`
  - `updateRequired`
- **E2E** (`e2e/installation.spec.ts`):
  - The stub shell answers `get_install_token`. `launchApp` defaults it to a stored token; the
    spec overrides it with `token: null` to test first launch.
  - The mocked BibleQL answers `registerInstallation` and records every request's
    `Authorization` header (`bibleqlRequests`).
- **Rust** (`cargo test`): the fallback file round-trip, and that it is owner-only.
