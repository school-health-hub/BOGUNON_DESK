# Newsletter NS-05 AI Engine Handoff

## Checkpoint

- Repository: `school-health-hub/BOGUNON_DESK`
- Branch: `codex/ns05-ai-newsletter-engine`
- Base before checkpoint: `7679f2ab740c2121cf3df05bcca2b79797f6d1b0`
- Status: implementation and focused automation PASS; Windows GUI QA CONDITIONAL
- LIVE OpenAI/Gemini calls: NOT RUN

## Implemented

- Provider-neutral OpenAI/Gemini text and image capability contracts
- Deterministic offline Mock, consent/cost/cancel handling, bounded Electron IPC/preload APIs
- Candidate review and field-level partial application with revision/hash conflict protection
- AI image provenance with `AI_GENERATED` and `exportApproval: pending`
- Pending-asset export blocking and direct-production-mode independence
- AI proposal topic IDs are bound to the current document's six stable topic IDs before application
- No-op applications do not create empty revisions; real edits record exact `changedSectionIds`

## Verification

- Focused Vitest after the text-application fix: 6 files, 71 tests PASS
- Electron TypeScript/product build: PASS
- `git diff --check`: PASS
- Windows GUI: CONDITIONAL. The isolated Electron profile launched, but computer automation exposed only the transparent Desktop Palette and did not complete the updated-build save/restart path.

Do not treat Mock PASS as LIVE provider verification. Do not mark Windows GUI persistence or PNG/PDF file QA PASS until it is rerun on the receiving PC.

## Receiving-PC restore

Preserve any local work first, then run:

```powershell
git fetch origin
git worktree add <new-worktree-path> codex/ns05-ai-newsletter-engine
git -C <new-worktree-path> status --short --branch
git -C <new-worktree-path> rev-parse HEAD
npm ci
npm exec vitest run -- src/newsletter/NewsletterAiProductionPanel.test.tsx src/newsletter/stagedAiProposal.test.ts src/newsletter/aiCandidateApplication.test.ts electron-p0/tests/newsletter-ai-ipc.test.ts electron-p0/tests/newsletter-ai-preload.test.ts electron-p0/tests/newsletter-ai-contract.test.ts
npm run electron:p0:build
```

Use the Electron-only entry point from the verified build. Do not invoke Rust, Cargo, or Tauri for this QA.

## Next QA only

1. Use an isolated synthetic project and offline Mock.
2. Apply one topic's title/body and verify the other five topics are byte-equivalent.
3. Save JSON, exit normally, restart, reopen, and verify text, revision, and exact `changedSectionIds`.
4. Verify image candidate provenance and `exportApproval: pending` survive restart.
5. Verify pending assets block export.
6. With separately approved synthetic assets, save and reopen A4/card PNG and PDF outputs.
7. Verify cancel/error paths preserve prior editor and file hashes.

If automation sees only the transparent Desktop Palette, investigate window identification and the isolated profile. Do not terminate unrelated Electron/Cargo processes or repeat the full Rust build.

## Non-Git material

Local `.qa-temp` and `.tmp-*` directories, screenshots, logs, user-data profiles, and synthetic saved JSON are intentionally excluded from Git. They may contain machine-local cache or evidence and were not uploaded. The next QA is reproducible from the committed source and commands above; the school-PC GUI evidence itself is not part of this handoff.

## Security

- API keys, tokens, user project JSON, browser profiles, screenshots, and build artifacts must remain excluded.
- No publication approval was granted to AI-generated assets.
- No external material or LIVE provider request was sent during this checkpoint.
