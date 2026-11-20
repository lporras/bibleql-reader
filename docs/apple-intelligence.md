# Apple Intelligence

The Assistant's third provider, next to Claude (an API key) and ChatGPT (a
sign-in): Apple's on-device model, through the **Foundation Models** framework.
It needs no key, no account and no network, and costs nothing.

## Who gets it

Any iPad or Mac that runs Apple Intelligence: iPadOS/macOS **26 or later**,
an Apple Intelligence–capable chip (iPad: M1 or later, or A17 Pro; Mac: Apple
silicon), and Apple Intelligence switched on in Settings, with its model
downloaded. There is no device list in the code. The plugin asks the framework
(`SystemLanguageModel.default.availability`) and the UI says what's missing:

| status | shown as |
| --- | --- |
| `available` | provider and its one model, "On this device" |
| `appleIntelligenceNotEnabled` | "Turn on Apple Intelligence in Settings" (offered in the setup prompt) |
| `modelNotReady` | "still downloading its model" (offered in the setup prompt) |
| `unsupportedLocale` | the app's language isn't supported on this device |
| `deviceNotEligible`, `unsupportedOS` | not offered in the setup prompt; explained if already chosen |

The status is re-checked whenever the window regains focus, since it changes in
Settings, outside the app. iPhone would work the same, but the iOS app is
iPad-only for now (docs/ios.md).

**There is no model catalogue.** Foundation Models gives apps one general model
(plus special-purpose variants such as `.contentTagging`, which aren't for chat)
and no access to Private Cloud Compute. The model select shows that one model,
disabled, so it's clear what answers.

**The system's "ChatGPT extension" setting has no effect here.** That
extension is for Siri and Writing Tools. Foundation Models never hands a
request to ChatGPT or any server.

## How it's wired

```
src/lib/ai.ts askApple ─ platform/appleai.ts ─ invoke("plugin:appleai|…")
                                                    │
src-tauri/plugins/tauri-plugin-appleai/src/lib.rs ──┤
   iOS:   run_mobile_plugin → ios/   (Tauri Swift plugin, a Channel arg)
   macOS: extern "C"        → macos/ (swift-rs static lib, C callback → Channel)
                                 └── both → core/ (AppleAssistantCore: the Foundation Models code)
```

- **core/** holds everything that touches the framework: availability, a
  `LanguageModelSession` built from the same system prompt as the other
  providers, in its own wording (`buildAppleInstructions`; see Limits), and **guided generation** (`@Generable
  GeneratedAnswer { answer; references[2...5] }`). The model can't produce any
  other shape, so unlike the ChatGPT route there's no JSON to ask for or repair.
  `streamResponse` snapshots go out as `partial` events, and exactly one
  `completed` or `failed {code}` ends every reply.
- **macOS** has no Swift plugin host in desktop Tauri, so the plugin's
  `build.rs` builds `macos/` with swift-rs (already in the lockfile through
  Tauri). The app's `src-tauri/build.rs` adds two linker flags for macOS
  targets: `-weak_framework FoundationModels`, so the app still launches on
  macOS 15, and `-rpath /usr/lib/swift`, without which dyld can't find the Swift
  runtime and the app aborts at launch.
- **iOS** weak-links the framework in `gen/apple/project.yml` (`weak: true`).
  After editing that file run `xcodegen generate`. It drops `DEVELOPMENT_TEAM`
  from the pbxproj and rewrites `CFBundleVersion` in Info.plist, so restore both.
- Every framework use is behind `#if canImport(FoundationModels)` (an older SDK)
  and `if #available(iOS 26, macOS 26, *)` (an older OS).
- The Swift packages are `swift-tools-version:6.0` (for `.macOS(.v15)`) in the
  Swift 5 language mode.
- The commands are plugin commands, so they need `appleai:default` in
  `capabilities/default.json`.

## Limits worth knowing

- **Refusals depend on the instructions' language, not on the topic.** On macOS 26.6
  (SDK 27.2), guided generation under English instructions was refused almost every time ("I
  apologize, but I cannot fulfill this request", a `refusal`), for harmless questions such as
  "Who is Melchizedek?". Even "You are a Bible study assistant. Be concise (120 words maximum)."
  was enough. Plain-text generation under the same instructions was fine, and so were the same
  instructions written in Spanish, in either answer language. So the model gets its own prompt,
  `buildAppleInstructions` in `src/lib/ai.ts`: always in Spanish, naming the answer's language.
  The `@Guide` descriptions are in Spanish too. Neither has an example reference, because the
  model copied the example ("Mateo 18:21-22") into nearly every answer. Both ask for full book
  names, because unprompted English answers used "Jn 3:16" and "Ex. 20:11", which `parseRef`
  can't open. An occasional refusal still happens, so core/ retries once, in a fresh session, when
  one arrives before any words. With all of that: 12/12 across en/es, with and without a study
  title. Recheck after an OS update: build a throwaway SwiftPM executable that depends on core/
  and feeds it `buildAppleInstructions`' output.
- **In a guided `String`, a blank line ends the field.** Asked for two paragraphs separated by a
  blank line, a one-string schema stopped after the first, 4 times out of 4. So answers stopped
  wherever the model began a second paragraph or a list ("…these are the main ones:" and nothing
  after). The answer is generated as `parrafos: [String]` instead, and core/ joins it (a blank line
  between paragraphs, one newline between list items) into the text the webview renders. Single
  newlines and quotes inside a string are fine.
- **The schema's field names are shown to the model**, so they're Spanish too (`parrafos`,
  `referencias`, `cita`, `motivo`; core/ maps them back to `answer`/`references`/`ref`/`why`).
  With English names and looser instructions, Spanish answers picked up English words
  ("fulfillment", "Zechariah"). The instructions now ask for one language throughout, and no bold:
  given bold, the model bolded word after word and left stray `**`, which core/ also strips.
- The model sometimes lists the same passage twice, or makes up a book name ("Micael 5:2").
  `applePartial` drops duplicates and references `parseRef` can't open, instead of giving them a
  disabled chip as the other providers do. It also writes each reference out again with the book
  named in the reader's language, since an English name still turns up in a Spanish answer now and
  then ("Zechariah 12:10" becomes "Zacarías 12:10").
- It quotes verses even when told not to, and the quotes are often made up. The chips open the
  real text from BibleQL or the downloaded translation, so treat the answer's quotes as unreliable.
- **It's a small model (~3B parameters, 4096-token context).** Apple says
  not to rely on it for world knowledge, and it does get things wrong: in testing
  it gave Matthew 18:21-22 as "seven times" and added off-topic references. The
  verse *text* always comes from BibleQL or a downloaded translation, never from
  the model, and a reference that doesn't parse gets a disabled chip, as for the
  other providers. If quality matters more, a next step is tool calling: let the
  model look passages up in the offline index or BibleQL before citing them.
- One request at a time per session (`concurrentRequests`). The Assistant
  already sends one at a time.
- Answers are filtered by Apple's guardrails (`guardrailViolation`/`refusal`),
  and the UI asks the reader to rephrase.

## Testing

- `src/lib/appleAnswer.test.ts`: the event stream → answer, failures → messages
  (the plugin is mocked).
- `src/lib/aiModels.test.ts`: provider choice. Apple Intelligence is a fallback
  only when Claude has no key, and it never falls back onto a billed key.
- `e2e/apple-intelligence.spec.ts`: the stub shell answers
  `plugin:appleai|availability`/`respond`. Pass `__platform: "ios"` or `"macos"`.
- On a real device: choose Apple Intelligence and ask in Spanish. Then try
  airplane mode with a downloaded translation: answers, chips and passage text
  should all still work. For the binary, `otool -l` should show
  `LC_LOAD_WEAK_DYLIB … FoundationModels` and an `LC_RPATH /usr/lib/swift`.
