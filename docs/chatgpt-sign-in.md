# Sign in with ChatGPT

Desktop users can answer Assistant questions with their own ChatGPT Plus or Pro plan, as an
alternative to an Anthropic API key. Everything runs between the app and OpenAI; BibleQL's server
isn't involved, and must not be: OpenAI's self-serve path is for open-source apps that run locally.
Hosted or paid apps have to apply through OpenAI's interest form.

OpenAI's docs for this are a preview and may change. Re-read them before changing the protocol code:
<https://developers.openai.com/siwc/token-sharing-open-source>.

No registration is needed. On first sign-in the app identifies itself as `dynamic_agent_client`, and
OpenAI issues a client ID (`oaiapp_…`) for that user, which the app keeps. Users see "OpenAI has not
verified this agent or its name" on the permission screen.

## Where it works

| Platform | ChatGPT |
|---|---|
| macOS, Windows, Linux | Yes |
| iOS, Android | Hidden. OpenAI documents only a loopback redirect, which isn't reliable while a mobile browser has the app suspended |
| Browser (`yarn dev`) | Hidden. The flow lives in Rust |

`CHATGPT_SUPPORTED` in `src/platform/host.ts` decides this.

Plans: a Free account is stopped on OpenAI's own permission screen ("A required permission is
unavailable"), with Continue disabled, so it never reaches the app. The app still handles
`subscription_sharing_user_not_eligible`, in case eligibility changes after sign-in.

## Design

**Tokens never reach the webview.** All OpenAI traffic is in `src-tauri/src/chatgpt.rs`, using the
HTTP plugin's re-exported `reqwest`. That's why there is no `api.openai.com` entry in
`capabilities/default.json`, no `@ai-sdk/openai`, and no forced `Origin` header on these requests.

| Command | Does |
|---|---|
| `chatgpt_sign_in` / `chatgpt_cancel_sign_in` | Runs or cancels the browser flow |
| `chatgpt_account` / `chatgpt_has_registration` | Safe account details; whether anyone has signed in here |
| `chatgpt_sign_out` | Revokes the refresh token, then clears the tokens |
| `chatgpt_models` | The account's models (`visibility == "list"`) |
| `chatgpt_respond` | Streams one reply over a `Channel` |

`src/platform/chatgpt.ts` is the frontend's only way in. Commands fail with a code from
`ChatgptErrorCode` in `src/types/ai.ts`. A failed reply also carries OpenAI's code, param, and a short
diagnostic message.

**No DevKit.** OpenAI's `@siwc/local` needs Node, and the DevKit is under a noncommercial license, so
don't use or copy from it. `chatgpt.rs` implements the documented protocol independently.

**ID tokens are verified with `ring`, not `jsonwebtoken`.** OpenAI's discovery document lists only
RS256. `jsonwebtoken`'s backends are the `rsa` crate, which has an open RUSTSEC advisory, or
`aws-lc-rs`, a C build on every target. The header's `alg` selects nothing, so a token can't choose
`none` or HMAC.

**Answers are JSON requested in the instructions.** The route documents plain text streaming only: it
doesn't document `text.format`, and it rejects top-level function tools. `askChatgpt` in `src/lib/ai.ts`
appends the JSON shape to the shared system prompt, shows partial answers with `parsePartialJson`,
and validates the result with the same `AiAnswerSchema` as Claude.

**The request body is deliberately small:** `model`, `instructions`, `input`, `store: false`,
`stream: true`. The route rejects `temperature`, `max_output_tokens`, `previous_response_id` and
others, plus `role: "system"` input items.

**Only `response.completed` is success.** `response.failed`, `response.incomplete` and a stream that
just ends are all failures, whatever text has arrived. A request is never resent automatically.

## Accounts and storage

One account is active at a time. The record also remembers each account's client ID by `sub`, because
a client ID is bound to one user and workspace and must never be mixed with another's tokens.

- **Continue with ChatGPT** reauthorizes the last client ID.
- **Use a different account** registers a new client. It's only offered when signed out.
- A different `sub` or client ID on reauthorization is rejected, and stored credentials stay untouched.
- A sign-in without `chatgpt.tokens.use.direct` stays signed in with `planEnabled: false`. The UI
  offers Reconnect, and inference refuses to run.
- Sign-out keeps the client IDs and `ext_agent_host_id`, and drops the tokens.

The record is stored through `src-tauri/src/secret_store.rs` (see
[installation-keys.md](installation-keys.md)), falling back to `chatgpt.json` in the app data dir. It's
written as generation-numbered chunks with a pointer as the commit, because Windows Credential Manager
refuses secrets over 2560 bytes, and a refresh token must never be half-replaced.

Refresh tokens rotate on every use, and reuse is terminal, so refreshes are serialized by a lock held
across the network call. Only the terminal codes in `is_terminal_refresh_error` clear a sign-in. Network
failures never do.

## Choosing who answers

`src/lib/aiModels.ts` holds the rules, and `useAiChoice` in `src/queries/useAiModels.ts` applies them.

- With no Claude key and a usable ChatGPT sign-in, ChatGPT answers.
- Never the reverse: an API key is billed to its owner, so losing a ChatGPT sign-in doesn't start
  spending it. Asking is blocked until the user signs in or picks Claude.
- A saved model that's no longer listed shows "Choose a model" and blocks asking. There's no silent switch.
- With nothing usable, the Assistant shows a setup prompt in place of the ask box.

Manage usage (<https://chatgpt.com/settings/usage>) and Refresh models live in AI settings. OpenAI's
UI guidelines suggest Manage usage next to "Using ChatGPT plan" as well; it was moved at the project's
request, so that's a known difference.

## Errors

`describeChatgptFailure` in `src/lib/ai.ts` follows OpenAI's "Errors and recovery" page. Some of these
are easy to get wrong:

- `subscription_sharing_usage_unavailable` is a temporary 503, not a plan problem.
- A 401 doesn't mean "sign in again". That's only after a terminal refresh error (`reauth_required`).
- Usage limits can arrive mid-stream, and no reset time should be implied.

## Testing

- **`cargo test`**: PKCE, authorize URLs, callback parsing, the loopback listener over a real socket,
  ID token validation with a throwaway key (`src-tauri/testdata/`), refresh rules, SSE parsing, the
  exact request body, and record storage.
- **`yarn test`**: `lib/aiModels.test.ts` and `lib/chatgptAnswer.test.ts`, with the Rust seam mocked.
- **`yarn test:e2e`**: `e2e/chatgpt.spec.ts`, with the commands answered by the stub shell. The
  `__platform` response key makes the stub report another OS.

Nothing automated reaches OpenAI, so these need real accounts:

- [ ] A real answer streams in the expected format, on each listed model you care about
- [ ] A first registration completes (see below)
- [ ] Refresh after more than an hour; revoked access
- [ ] Sign-out with revocation; switching to a second account
- [ ] Reaching the usage limit
- [ ] Sign-in and storage on Windows and Linux

## Known issue

The first sign-in tested returned `invalid_grant` from the code exchange, and trying again succeeded.
The cause isn't known: OpenAI's docs prescribe that recovery but don't explain the error, and the app
doesn't record OpenAI's error details. If it recurs on new registrations, log the error code and
description in debug builds to find out.
