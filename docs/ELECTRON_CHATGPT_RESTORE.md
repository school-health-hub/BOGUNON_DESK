# Electron ChatGPT account restoration

Baseline: integration/electron-feature-baseline@5167b1748a53b1eac4a7a5c8805e680c62c875be.
Feature branch: feature/electron-chatgpt-restore. No changes to original Tauri sources.

## User flow

Settings → AI connection → ChatGPT: Continue with ChatGPT opens the official system
browser through Main's fixed authorization guard. OAuth uses fresh PKCE S256/state/nonce,
127.0.0.1 ephemeral /auth/callback, stable host ID, dynamic first registration and issued
client reauthorization. Rust verifies JWKS signature/issuer/audience/expiration/nonce,
checks granted chatgpt.tokens.use.direct, and stores tokens using Windows user DPAPI.
Login and model-list success never imply inference success. Explicit refresh loads only
visibility:list account models. Model selection stays account-bound. The synthetic text
button requires a native confirmation; inference uses public /v1/responses, array input,
store:false, stream:true, and completion required. Usage/rate/permission/refresh/temporary
errors do not trigger another provider or billing path. Sign-out attempts refresh-token
revocation and keeps registration/host for reauthentication; remote revocation failure
is reported separately. Existing API-key credentials are untouched.

Official Document, Newsletter and Finder retain their existing API text contract, with
an explicit ChatGPT route selector. Neither route overwrites manuscripts or library data.
Main validates prompt size/privacy and native consent. API Key and OAuth tokens never
cross Preload. ChatGPT IPC exposes only status/signIn/refreshModels/selectModel/
acknowledge/generate/disconnect/cancel; no URLs, paths, tokens or arbitrary invocation.
The browser URL event stays in Main. User actions are required for OAuth, catalog refresh
and generation; status reads only local state. Settings shows real capability/status,
not a successful inference claim. ChatGPT plan/credits differ from API billing.

## Protection and limitations

The Electron-only DPAPI directory is independent of Tauri, Finance and API credentials.
Only one ChatGPT registration is supported initially. A different returning identity
cannot overwrite it. Model choice and inference verification are session-local; users
refresh/select again after restart. OpenAI and Gemini retain their existing single active
API connection; ChatGPT operates alongside either. No image AI route is enabled. Future
Purchase AI-FIRST can reuse the Main runner, cancellation, scope checks, account-bound
catalog and consent boundary; it still needs image-specific capability/DTO/consent work.
P1/P2 OCR, output engines, Soft Rose, data contracts and Native WorkerW exclusion remain.

Cancellation/navigation/window close kills the owned helper. App quit includes its flush
in the existing cleanup barrier. Original files are not migrated or reset. An already
completed OAuth exchange may remain stored if cancellation races its completion; status
reconciles it, and explicit disconnect revokes it. No tokens/prompts are logged.

## Build and verification boundary

Fourth native CLI: tools/chatgpt-auth-cli, distinct from the existing three. Standard
package scripts build it first. build-chatgpt.mjs records source SHA, executable hash
and original Rust source hashes; beforePack verifies provenance and extraResources.
No new workflow, Portable or existing external-drive executable is created/replaced.

Focused validation: reused original Rust OAuth/loopback/OIDC/storage/refresh/SSE tests,
helper adapter parsing, Main sender/arity/schema/permission/consent/cancellation, separate
API credentials, Renderer routing, owned process timeout/loopback-close and packaging.
Linux helper authentication is intentionally disabled. Windows cross-check in Cloud is
blocked by missing MSVC lib.exe (ring dependency); it is not a Windows compile PASS.
Windows native build, DPAPI round-trip, system browser authentication, actual account
model listing, real Responses call, revocation and Portable lifecycle are NOT RUN.
No real credentials, personal/school data or paid AI calls used.

Official references (reviewed 2026-11-04):
- https://developers.openai.com/siwc/token-sharing-open-source
- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations

This OSS/local-app implementation does not certify account/workspace/model entitlement.
Paid/remote distribution needs the separate conditions stated in the official documents.

## Cloud result

- Reused Rust core + adapter: 83 tests PASS; locked debug and release helper builds PASS.
- Electron AI/Main/Preload/UI + selected Purchase OCR UI regression: 71 tests / 12 files PASS.
- Actual builder-selected ASAR runtime graph + native packaging contracts: 5 tests PASS.
- Electron Main, Renderer and test TypeScript checks, production frontend build: PASS.
- Linux native authentication refusal smoke: PASS (no external request).
- Windows target check: BLOCKED by missing MSVC lib.exe; not a Windows PASS.
- Secret/binary/scope scan and git diff --check: PASS. No Portable or workflow run.
