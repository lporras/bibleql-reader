# Bible Reader

An open-source desktop Bible reader built on the [BibleQL](https://github.com/lporras/bibleql) GraphQL API.

## What it does

- Read any translation BibleQL serves (43 translations, 31 languages)
- Compare two translations side by side
- Concordance: exhaustive, canonically ordered word study with keyword-in-context
- Text search across the current translation
- AI assistant for Bible questions, answering with openable references
- Light / dark themes, English and Spanish interface locales

Version 2 (server-side): bookmarks and reading plans.

## Stack

[Tauri 2](https://tauri.app) + React + TypeScript, built with [Vite](https://vite.dev). The UI runs
in the platform's own webview and the shell is a small Rust binary, so there's no bundled browser
engine. Server state (translations, passages, concordance, search) is managed with
[TanStack Query](https://tanstack.com/query), navigation with
[React Router](https://reactrouter.com) (hash-based), and styling with Sass — a single token
partial (`src/styles/_tokens.scss`) drives both the light and dark palettes as CSS custom
properties, and every component has its own colocated `.module.scss`.

```
src/         the React app (components/, features/, queries/, hooks/, state/, lib/, data/, styles/)
  platform/  the one seam onto the desktop shell — see docs/platform-abstraction.md
src-tauri/   the Rust shell: window config, plugin registration, capability permissions
```

## Running as a desktop app

Needs [Node](https://nodejs.org), [Yarn](https://yarnpkg.com) and a
[Rust toolchain](https://www.rust-lang.org/tools/install) (plus Tauri's
[system prerequisites](https://tauri.app/start/prerequisites/) — Xcode command line tools on macOS,
WebView2 on Windows, `libwebkit2gtk` on Linux).

```bash
yarn install
cp .env.example .env   # set BIBLEQL_API_KEY
yarn tauri dev         # Rust shell + Vite dev server, with HMR
yarn tauri build       # type-checks, runs unit tests, then bundles installers
```

`yarn dev` on its own serves just the frontend in a browser at http://localhost:1420 — useful for
UI work, though the native Save-As dialog and the AI assistant need the real shell.

Requests go to `https://bibleql.org/graphql` with an `Authorization: Bearer` header. The BibleQL
key comes from `BIBLEQL_API_KEY` in `.env` (loaded via `dotenv`) and is compiled into the app at
build time — it's never entered by end users and never committed. Release builds get their key the
same way, from a `BIBLEQL_API_KEY` GitHub Actions secret set on the workflow. Without a key, the
reader shows a bundled public-domain sample chapter (Psalm 23).

The AI assistant calls Claude via the [Vercel AI SDK](https://ai-sdk.dev) (`src/lib/ai.ts`), with
the request itself issued by the Rust side through Tauri's HTTP plugin — `api.anthropic.com`
refuses cross-origin requests. (The plugin still attaches its own `Origin`, so the call also
opts in via `anthropic-dangerous-direct-browser-access`; the key is the user's own and the
request is made by the Rust process, not by a page anyone else can script.) Unlike the two keys above, the Anthropic key is never compiled in:
it's entered per-user from the key dialog (key icon in the title bar) and stored locally — never
committed or sent anywhere else.

Get a BibleQL key at https://bibleql.org/api-keys/request/new (docs: https://docs.bibleql.org) and
an Anthropic key at https://console.anthropic.com.

## Running on an Android device

The Android project is already generated and committed in `src-tauri/gen/android`, so there's no
`tauri android init` step. You only need to do the one-time setup below.

### One-time setup

1. Install [Android Studio](https://developer.android.com/studio). From its SDK Manager
   (*Settings → Languages & Frameworks → Android SDK*), install:
   - **SDK Platforms:** Android 16 (API 36), the version `compileSdk` uses
   - **SDK Tools:** Android SDK Build-Tools, Android SDK Platform-Tools, Android SDK
     Command-line Tools, and **NDK (Side by side)**
2. Install **JDK 21** and point `JAVA_HOME` at it. Don't use Android Studio's bundled JBR:
   recent versions ship JDK 25, and Gradle 8.14's Kotlin compiler can't parse that version
   string. When that happens, the build dies under `:buildSrc` with nothing but `> 25.0.3`, and
   nothing in the error mentions Java. Run `/usr/libexec/java_home -V` to see which JDKs you have.
3. Export the environment variables (in `~/.zshrc` or equivalent; these paths are macOS defaults):

   ```bash
   export JAVA_HOME="/path/to/jdk-21/Contents/Home"
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export NDK_HOME="$ANDROID_HOME/ndk/$(ls -1 "$ANDROID_HOME/ndk" | sort -V | tail -1)"
   export PATH="$ANDROID_HOME/platform-tools:$PATH"   # for adb
   ```

4. Add the Rust targets for Android:

   ```bash
   rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
   ```

### Preparing the phone

1. Turn on **Developer options**: *Settings → About phone*, then tap **Build number** seven times.
2. In *Settings → System → Developer options*, turn on **USB debugging**.
3. Connect the phone over USB and accept the "Allow USB debugging?" prompt on the phone.
4. Check that the phone shows up with the state `device`. If it says `unauthorized`, re-accept the
   prompt on the phone:

   ```bash
   adb devices
   ```

### Connecting over Wi-Fi instead of USB

On Android 11 and later you can skip the cable. The phone and the computer must be on the same
Wi-Fi network (guest networks and networks with client isolation block it).

1. On the phone, in *Developer options*, turn on **Wireless debugging**, open it, and tap
   **Pair device with pairing code**. It shows an IP address and port plus a six-digit code.
2. Pair using that address. `adb` asks for the code:

   ```bash
   adb pair 192.168.1.50:37123
   ```

3. Connect. Use the **IP address & port** shown on the main *Wireless debugging* screen. The
   port there is **not** the pairing port from step 1:

   ```bash
   adb connect 192.168.1.50:41234
   adb devices     # should list 192.168.1.50:41234   device
   ```

You only pair once per computer. After that, `adb connect` is enough, but the connect port
changes each time wireless debugging is turned back on, so check it on the phone. If the pairing
code is rejected, it probably expired, so reopen the pairing dialog to get a new one. If the device
shows up as `offline`, run `adb kill-server` and connect again.

### Dev build, with HMR

```bash
yarn tauri android dev
```

If both a phone and an emulator are connected, the CLI asks which one to use. The app on the
phone loads the frontend from the Vite dev server on your computer. For that to work, the CLI
sets `TAURI_DEV_HOST` to your machine's LAN IP, and `vite.config.ts` binds to it. That means **the
phone and the computer must be on the same Wi-Fi network**, and your firewall has to allow
incoming connections on ports 1420/1421. If the CLI asks which network interface to use, pick
the one on that shared network, or pass it explicitly with
`yarn tauri android dev --host <your-computer's-LAN-IP>` (useful when a VPN interface gets picked).
If the app opens to a blank screen or a connection error, check the network first.

To debug the webview, open `chrome://inspect` in desktop Chrome while the phone is connected.

### Installable APK

```bash
yarn tauri android build --debug --apk
adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

This builds a self-contained APK: the frontend is bundled in, so the phone doesn't need your dev
server. Add `--target aarch64` to build for 64-bit ARM only, which covers nearly every current
phone and builds much faster. The APK file name then includes `arm64` instead of `universal`.

`yarn tauri android build --apk` (without `--debug`) produces a release APK. That APK is
**unsigned**, and Android won't install it until you sign it with your own keystore (see Tauri's
[Android code signing](https://tauri.app/distribute/sign/android/) guide). For testing on your own
phone, use the debug build.

As on desktop, the BibleQL key is compiled in from `.env` at build time, so set it before you
build.

## Running tests

```bash
yarn test       # Vitest — pure-logic unit tests (no network, no shell)
yarn test:e2e   # Playwright — builds the app, then drives it in a browser
```

`yarn test` covers things like project serialization, layout math, and reference formatting —
fast, and safe to run without any keys configured. `yarn test:e2e` (`e2e/*.spec.ts`) drives the app
like a user would: selecting verses, handing off to the Verse Image Creator, picking a background,
editing text, exporting. It runs the same bundle in headless Chromium rather than in the Tauri
window, because Tauri's own WebDriver harness (`tauri-driver`) has no macOS support at all; the
handful of genuine shell calls are stubbed and recorded (see `e2e/helpers.ts`). It builds the app
and serves it with `vite preview`. BibleQL and Unsplash are mocked, so it needs no API keys. CI (`.github/workflows/ci.yml`) runs both suites plus
a `cargo check` of the Rust shell on every pull request.

## macOS: "is damaged and can't be opened"

Release builds aren't code-signed/notarized yet, so macOS Gatekeeper blocks them after download
with `"BibleQL Reader" is damaged and can't be opened. You should move it to the Trash.` This is a
Gatekeeper quarantine issue, not an actual corrupt download. Workaround:

```bash
xattr -cr "/Applications/BibleQL Reader.app"
```

(adjust the path if you didn't install it to `/Applications`). This only fixes it for the copy you
run it on — every user hitting a release build hits the same dialog until the mac build is signed
with an Apple Developer ID and notarized in CI.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Bible texts keep their own licenses — each translation's `note` field carries it, and the
app shows it in the status bar.
