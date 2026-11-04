# Electron ChatGPT authentication helper

Fourth native resource, separate from Purchase Excel, Official Document and MY FINANCE.
No Tauri runtime dependency. `build.rs` consumes the original `src-tauri/src/chatgpt/**`
source and unit tests at build time. It omits the Tauri command adapter, exposes the
lifecycle module to this adapter, substitutes Tokio spawn_blocking and the test-only
block_on executor. Authentication, token rotation, OIDC validation, DPAPI and SSE
logic are not rewritten in JavaScript. Original Tauri files are unchanged.

One JSON-line request on stdin per owned process. Responses are bounded in Electron
Main. The only intermediate event is an authorization URL; Main validates it and opens
the system browser. Neither this event nor tokens enter Renderer. All error output is
replaced with fixed codes. Token echoes in public results are rejected inside Rust.

Actions: state, signIn, models, generate, generateImages, acknowledge, disconnect. Unknown fields and
actions fail closed. Generate binds the hashed registration identity, checks current
account models and granted direct-plan scope and requires response.completed. Main
confirms tool/model/prompt before generation. No API-key fallback or automatic retries.

Storage: Electron-only work-data/chatgpt, original DPAPI user-scope encrypted registration
and credential formats; stable opaque host ID. No Tauri data read/import. A saved
registration binds one user/workspace; reauthentication with a different identity is
rejected. Multiple saved ChatGPT accounts are not implemented. Purchase image requests use the
separate bounded generateImages adapter; the original OAuth/DPAPI/text core is unchanged.
Selected model and successful-call indicator are session-local and reset on restart.
OpenAI/Gemini remain the existing single active API connection, independent of ChatGPT.

Cancellation/timeout kills only the owned helper and waits for close. The process owns
the loopback listener and HTTP tasks; Windows closes those handles on process exit.
Cancelling cannot retract already-sent content or a token exchange already committed.
A subsequent explicit status read reconciles completed authentication with disk state.

Build: cargo build --locked --manifest-path tools/chatgpt-auth-cli/Cargo.toml
Package resource: node scripts/electron-p0/build-chatgpt.mjs --release
The latter stages the executable and a SHA-256/core-source manifest outside ASAR.
The existing package commands build this helper and beforePack fails if missing or
mismatched. Windows MSVC build/DPAPI/browser/live inference need Windows follow-up.
Linux builds are for contract testing only; the executable refuses authentication on
non-Windows, with no plaintext credential fallback. No Portable was built here.
