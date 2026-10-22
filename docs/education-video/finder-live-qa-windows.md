# Finder Windows Live QA executable

Approved Finder base: f0981bf965b191ca380d5a97afe9aa61f9a1c3d8.
The Windows artifact uses this checkpoint plus the minimum QA wrapper commit. SOURCE.json records both baseSha and actual sourceSha and SHA-256. It must not be described as an unmodified f0981bf binary.

Build: `.github/workflows/finder-live-qa-windows.yml`, existing pinned Windows checkout/Node/Rust/cache actions, exact event SHA, ancestry and QA-only file guards. No production release environment, signing key, service API key, deployment or installer. Build output is a portable executable with identifier `kr.sungandi.schoolhealthdesk.finderliveqa`.

The QA frontend mounts the existing Finder and common ChatGPT/official-document layers, not the full dashboard, updater, Google or Supabase providers. Existing synthetic QA entry remains unchanged. QA metadata verifies frontend/native source, approved base, identifier, isolated library and false external dispatch.

Existing local ChatGPT credentials are read by the existing native DPAPI storage under the production identifier folder. No credential copies or values are printed. The QA storage rejects every credential mutation and the QA transport rejects discovery, refresh and revoke before HTTP. Expired access credentials therefore block QA; a fresh connection must be prepared by the human in the operating app. The QA does not sign in, disconnect, refresh or change the operating account.

Search is limited to one durable reservation before HTTP dispatch, including across restarts. No automatic retries. One separate public-description text review is allowed only after successful search. Do not delete receipts to retry. The global receipt is in the separate QA app-local-data folder. Existing YouTube Desktop/Proxy dispatch flags remain false.

## Run prerequisites

Download the artifact from the successful SHA-bound Actions run; compare SOURCE.json sourceSha/runId and executable SHA-256 to the run. Run only the separate `bogunon-desk-finder-live-qa.exe`, never an installer or the operating executable path. Preserve the production app and all data. A child-only WebView2 debugging argument may be used for local browser QA if native window automation cannot target the QA window; never change machine/user environment or policy.

Preflight before any search: native metadata/SHA match, Finder visible, existing connection connected with plan use enabled, account model catalog contains a documented supported model, search button enabled and invocation path registered. Do not print account identifiers, tokens, headers, cookies or full connection state. If credentials/model/permission cannot be confirmed, stop with zero search requests.

Approved live input: 고등학생 / 마약류 예방교육 / 20분 내외 / 공공기관 우선. Submit once through the existing privacy confirmation. On error stop; do not retry or replace with a different provider. If successful compare original URLs/sources/metadata status, inspect public-description review, open the existing draft screen and save/reload in the QA-only library. Never submit a real document or share externally.

Local limits: C: about3.46GiB and current Perl lacks Locale/Maketext/Simple, so no local fullnative build or package/cache cleanup. Parent automation kernel asset error has no identifiedmissingpath; a freshchildNodeREPL successfully initializedsky and enumeratedwindows. No system/runtime installation changes were made.
