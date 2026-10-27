# Running on iPad

The Xcode project lives in `src-tauri/gen/apple`. `tauri ios init` generated it once, and it's
committed the same way `src-tauri/gen/android` is, so most people never need to run `init`
themselves. The Rust shell builds for iOS unchanged: `src-tauri/src/lib.rs` already has the
`mobile_entry_point`, and `Cargo.toml` builds a `staticlib`, which is what Xcode links.

The project is **iPad-only** for now (`TARGETED_DEVICE_FAMILY: 2` in `project.yml`), because the
layout isn't responsive down to phone widths yet. On iPad it supports all four orientations. When
the layout handles phones, set it to `"1,2"` and run `xcodegen generate` in `src-tauri/gen/apple`.

## Why you need the full Xcode

The Command Line Tools (`xcode-select --install`) are **not enough**, even for a physical iPad:

- **No iOS SDK.** They ship only the macOS SDK. The Rust targets `aarch64-apple-ios` and
  `aarch64-apple-ios-sim` link against the iOS SDKs.
- **No `xcodebuild`.** `tauri ios dev` and `tauri ios build` generate an Xcode project and build it
  with `xcodebuild`.
- **No simulator, signing, or device tooling.** `simctl`, code signing, provisioning, and
  installing on a device all come with Xcode.

If the active developer directory is still the Command Line Tools, every `tauri ios` command fails
with `tool 'xcodebuild' requires Xcode, but active developer directory
'/Library/Developer/CommandLineTools' is a command line tools instance`.

## One-time setup

1. Install **Xcode** from the Mac App Store. It's a large download. Open it once and accept the
   license.
2. Point the command-line tools at it and finish its first-launch setup:

   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -runFirstLaunch
   xcodebuild -version      # should print the Xcode version, not an error
   ```

3. Install the **iOS Simulator runtime**. Xcode includes the iOS SDK but downloads the simulated
   OS separately, which is several more GB:

   ```bash
   xcodebuild -downloadPlatform iOS
   ```

   You can also do this in Xcode under *Settings → Components*. Until the runtime is installed,
   `xcrun simctl list devices available` prints an empty `== Devices ==` list.

4. Add the Rust targets. On an Intel Mac, also add `x86_64-apple-ios` (the simulator target there):

   ```bash
   rustup target add aarch64-apple-ios aarch64-apple-ios-sim
   ```

5. Install **XcodeGen**. Tauri uses it to generate the `.xcodeproj` from `project.yml`:

   ```bash
   brew install xcodegen
   ```

6. Check that iPad simulators exist:

   ```bash
   xcrun simctl list runtimes
   xcrun simctl list devices available | grep iPad
   ```

   Installing the runtime normally creates a default set of iPhones and iPads. If there's no iPad,
   create one:

   ```bash
   xcrun simctl list devicetypes | grep iPad
   xcrun simctl create "iPad Pro" "iPad Pro 13-inch (M5)" com.apple.CoreSimulator.SimRuntime.iOS-27-1
   ```

## Generating the Xcode project

Skip this step if `src-tauri/gen/apple` already exists. It only applies to a fresh checkout from
before the project was committed, or after you deliberately deleted the project:

```bash
yarn tauri ios init
```

The minimum iOS version comes from `bundle.iOS.minimumSystemVersion` in `tauri.conf.json`
(`15.0`). Tauri's template defaults to 14.0, which current Xcode refuses to build ("the range of
supported deployment target versions is 15.0 to …"). If you change it, update
`options.deploymentTarget` in `project.yml` too and run `xcodegen generate` in `src-tauri/gen/apple`.

App settings belong in `project.yml`, not the `.xcodeproj`. The `.xcodeproj` is regenerated from
`project.yml`, so edits made in it are lost. The generated `.gitignore` already excludes `build/`,
`Externals/` (the compiled `libapp.a`), and `xcuserdata/`.

## App icon

The iOS icons in `src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset` are the same artwork as
the desktop icon, adapted for iOS. Don't run `yarn tauri icon` on `src-tauri/icons/icon.png`
directly, for two reasons:

- **iOS masks the corners itself.** The desktop artwork is a macOS-style rounded tile on a white
  margin. On iOS that would show up as a white frame around a smaller icon. iOS wants a full-bleed
  square and applies its own corner mask. The iOS master was made by cropping the high-resolution
  `build/icon.png` to the blue tile and filling its corners with the tile's gradient (1024×1024,
  opaque).
- **`tauri icon` would overwrite the desktop and Android icons too.** Generate into a scratch
  folder with `yarn tauri icon <ios-master.png> -o <tmp>` and copy only `<tmp>/ios/*.png` into the
  `AppIcon.appiconset`.

App Store validation also rejects an app icon that has an alpha channel, even a fully opaque one,
and `tauri icon` writes RGBA. Check with `sips -g hasAlpha <png>`, and re-encode without alpha if
it says `yes`.

## Simulator, with HMR

First boot the iPad in **DeviceHub**, Xcode 27's replacement for Simulator.app
(`open -b com.apple.dt.Devices`), and wait for its home screen. Then:

```bash
yarn tauri ios dev "iPad (A16)"
```

Leave the name out to pick from a list. The CLI builds the Rust code for the simulator, boots the
simulator, installs the app, and launches it. The first build compiles every crate for a new target
and takes several minutes. Later builds are incremental.

As on Android, the app loads its frontend from the Vite dev server on your Mac. The CLI sets
`TAURI_DEV_HOST`, and `vite.config.ts` binds to that address. Frontend edits hot-reload, and Rust
edits trigger a rebuild and relaunch.

In the simulator:
- **Rotate:** ⌘← / ⌘→
- **Home:** ⇧⌘H
- **Keyboard:** connect your Mac's keyboard (I/O → Keyboard)

To debug the webview, use Safari's Web Inspector. In Safari, turn on *Settings → Advanced → Show
features for web developers*, then pick *Develop → Simulator → localhost*. You get the console,
network, and DOM, like Chrome DevTools on desktop.

## On a physical iPad

iOS won't run an unsigned app, so a device build needs a signing identity:

1. In Xcode, sign in under *Settings → Accounts* with your Apple ID.
   - A **free** Apple ID can install on your own devices, but its provisioning profiles expire after
     **7 days**. After that the app won't open until you rebuild.
   - A paid Apple Developer membership gives you profiles that last a year, and TestFlight.
2. Tell Tauri your Team ID (in Xcode, *Settings → Accounts →* your team, or on
   <https://developer.apple.com/account> under *Membership*). Either set it in
   `src-tauri/tauri.conf.json`:

   ```json
   "bundle": { "iOS": { "developmentTeam": "ABCDE12345" } }
   ```

   or export `APPLE_DEVELOPMENT_TEAM=ABCDE12345` so it stays out of the repo. Without a team ID,
   the build stops at signing.
3. On the iPad, turn on *Settings → Privacy & Security → Developer Mode* (it restarts), connect it
   to the Mac by USB, and tap **Trust** when it asks about the computer.
4. Run it:

   ```bash
   yarn tauri ios dev          # pick the iPad from the list
   ```

   As with an Android phone, **the iPad and the Mac must be on the same Wi-Fi network**, and the
   firewall has to allow incoming connections on ports 1420/1421, because the app loads the
   frontend from your Mac. If the CLI picks the wrong interface (a VPN, say), pass
   `--host <your Mac's LAN IP>`.
5. On a free account, the first launch fails with "Untrusted Developer". Allow it under
   *Settings → General → VPN & Device Management*.

Web Inspector works on the device as well. Turn on *Settings → Apps → Safari → Advanced → Web
Inspector* on the iPad, and the iPad then shows up in Safari's *Develop* menu.

## Self-contained builds

These bundle the frontend in, so no dev server is needed:

```bash
yarn tauri ios build --debug --target aarch64-sim    # a .app for the simulator
yarn tauri ios build                                 # a signed .ipa for devices (needs a team)
```

The `.ipa` ends up under `src-tauri/gen/apple/build/`. `ExportOptions.plist` controls how it's
exported (development, ad-hoc, or App Store). As on desktop, `BIBLEQL_API_KEY` and
`UNSPLASH_ACCESS_KEY` are compiled in from `.env` at build time, so set them before you build.

App Store distribution has one more blocker: the `macos-private-api` feature in `Cargo.toml`. It's
macOS-only and inert on iOS, but Apple's review is a separate question (see the CLAUDE.md
gotcha). It isn't needed for local or TestFlight testing.

## Troubleshooting

- **`simctl list devices available` is empty.** No simulator runtime is installed. Run
  `xcodebuild -downloadPlatform iOS`.
- **"requires Xcode, but active developer directory … is a command line tools instance".** Run
  `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.
- **"deployment target 'IPHONEOS_DEPLOYMENT_TARGET' is set to 14.0, but the range … is 15.0 to
  …".** The project was generated with Tauri's default. Set the deployment target to 15.0 as
  described in [Generating the Xcode project](#generating-the-xcode-project).
- **The app opens and closes immediately; the crash report (`~/Library/Logs/DiagnosticReports/BibleQL
  Reader-*.ips`) shows `UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`.** iOS 27
  kills apps that don't use the UIScene lifecycle. Tauri's windowing crate, `tao`, only adopts it
  unconditionally from 0.37, so the `tauri` crate must be **2.12 or later** (it pulls in
  tauri-runtime-wry 2.12 → tao 0.37). Upgrade `@tauri-apps/api` to the same minor version too,
  since Tauri won't start if the two disagree.
- **The CLI builds with `-sdk iphoneos` for a simulator, then fails with "Signing for … requires a
  development team".** Xcode 27's `devicectl` lists any simulator that has ever been booted as a
  connected device, and `@tauri-apps/cli` older than 2.12.4 mistakes it for a real iPad. Use CLI
  2.12.4 or later (`package.json` requires it).
- **No Simulator.app.** Xcode 27 ships **DeviceHub** (`open -b com.apple.dt.Devices`) instead.
  Keep it open while a simulator boots: a simulator booted with no window attached has no
  display, and its first-boot data migration crashes (`com.apple.datamigrator` aborts in
  `query_displays()`), leaving the boot stuck at "Waiting on BackBoard" or "Waiting on Data
  Migration". If that happens, run `xcrun simctl shutdown all && xcrun simctl erase "<iPad>"`,
  open DeviceHub, and boot it from there.
- **"Unable to lookup in current state: Shutdown" right after "Deploying app to device...".** The
  simulator wasn't booted. Boot it in DeviceHub first, then run `yarn tauri ios dev "<iPad>"`.
- **A YouTube video in a study shows "Error 153" (Error de configuración del reproductor de
  video).** YouTube refuses to play embeds whose request has no `Referer`, and the app is served
  from `tauri://localhost`, which sends none. The player's `origin` / `widget_referrer`
  parameters don't help. So wherever the app isn't on http(s), the study editor shows the video's
  thumbnail with a "Ver en YouTube" button instead of the player (`studyYoutube` in
  `StudyEditor.tsx`). The stored study and the PDF are unchanged.
- **The first boot of a new simulator takes 5 to 15 minutes**, and system apps such as Calendar
  may crash with `0x8BADF00D` (watchdog) while it settles. That's harmless and doesn't happen on
  later boots.
- **`xcodegen: command not found` during `init`.** Run `brew install xcodegen`.
- **"Signing for … requires a development team".** This only happens on device builds. Set
  `bundle.iOS.developmentTeam` or `APPLE_DEVELOPMENT_TEAM`.
- **"Unable to find a destination matching …" / unknown device name.** Copy the name exactly as
  `xcrun simctl list devices available` prints it, without the UUID.
- **Blank white screen in dev.** The app couldn't reach the Vite dev server. On a device, check the
  Wi-Fi and the firewall. On the simulator, check that nothing else is using port 1420.
- **`version mismatched Tauri packages`.** This is the same rule as on desktop: npm packages and
  Rust crates must match on major/minor.
