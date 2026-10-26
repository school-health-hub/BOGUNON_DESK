# Finder fourth QA preparation

A checkpoint: 419e31e2c9e32c6a36dd6c4982572436fb96669b. The original stream-test additions remain in that checkpoint.

The portable QA overlay uses the existing isolated identifier and reads production credentials without refreshing or writing them. It requires preserved receipts 1, 2, and 3 before atomically reserving receipt 4. No receipt is reserved by build, metadata inspection, or model listing. Existing records are never overwritten.

Request conditions remain the exact approved public prompt fingerprint, gpt-6.1-sol, drug prevention, high-school students, about 20 minutes, public sources first. The search body and QA transport require tool_choice auto. Prompt, output parsing and source validation are unchanged by this overlay.

Actual AI requests are NOT approved in this preparation step. Do not click search or accept the transmission confirmation until a separate approval. No automatic retries, AI review, draft generation or library writes are part of preparation. Both legacy external dispatch flags remain false.

CI builds the exact overlay commit, verifies A checkpoint ancestry, and packages SOURCE.json plus executable SHA-256. Download to artifacts/finder-live-qa/<source-prefix>/ without replacing earlier QA executables or the installed application.

Preflight: verify executable hash and embedded source metadata, unused fourth slot with three preserved attempts, readonly connection state and model list, and gpt-6.1-sol availability. Expired credentials block this check; renew through the normal operating-app UI only when separately requested by the user. A plan-available label alone is not proof of a valid token.

Offline checks: node node_modules/vitest/vitest.mjs run src/finder-live-qa/services.test.ts src/education-video/AiVideoFinder.autoSearch.test.tsx; node node_modules/typescript/bin/tsc --noEmit; cargo test --offline --manifest-path src-tauri/education-video-harness/Cargo.toml live_qa_policy. No full local native rebuild.
