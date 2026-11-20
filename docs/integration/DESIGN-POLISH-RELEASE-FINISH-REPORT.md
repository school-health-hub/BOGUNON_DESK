# DESIGN POLISH · Soft Rose Glass / Cream Bento

Date: 2026-11-20
Branch: `codex/design-polish-cream-bento`
Baseline: `296390df0633ca53e299ed706f1db8249ddaccd2`
Packaged product source: `00e4e05d20b6d957d17417cd5e6b0be27be1c40b`
Internal QA version: `2.0.0-beta.3`
Verdict: **CONDITIONAL — candidate ready for the user's final design review; not approved for external distribution.**

## Change and design comparison

The existing Bento layout, 13 widget IDs, Palette ownership and coordinates, Dock, Workspace routes, IPC, auth, and data schema are unchanged. `design-polish.css` uses the existing DESIGN-07 tokens after the existing styles and scopes its rules to the Electron candidate. It strengthens rose borders, focus and selected states, and brings the six work modules onto cream or warm white surfaces. The Dock layout and icon order are unchanged.

Palette remains transparent outside its cards. The summary and clock cards use a 96% warm fill; the memo card uses 98%. The compact memo no longer shows the outer fieldset scrollbar. A long synthetic memo still scrolls inside its textarea. The three-widget Palette default is intentional; it does not migrate or overwrite an existing Workspace's widget visibility.

The official-document, Inventory, Finder, Purchase, Newsletter and AI connection screens replace several development labels with Korean explanations. Security and cost notices remain. No product workflow, save format, auth path, or external AI call was changed.

Tracked product and test changes: `DESIGN.md`; `electron-p0/package.json`; `electron-p0/renderer/design-polish.css`, `main.tsx`, `palette/main.tsx`, `ai/AiTools.tsx`, `ai/ChatGptSettings.tsx`, `inventory-preview/InventoryHost.tsx`, `purchase/PurchaseSession.tsx`, `purchase/usePurchaseSettings.ts`; `electron-p0/tests/design-polish-style.test.ts`, `official-document-files-ui.test.tsx`, `purchase-settings-ui.test.tsx`; `src/education-video/EducationVideoFinder.tsx`, `src/inventory-management/InventoryWorkspace.tsx`, `src/newsletter/NewsletterStudio.tsx`, `src/official-document/OfficialDocumentWorkspace.tsx`. This report is the only additional tracked document.

## Focused verification

| Check | Result |
| --- | --- |
| TypeScript, root and three Electron configs | 4/4 PASS |
| Focused Vitest | 57/57 PASS after updating one stale official-document label assertion; eight other files had passed in the preceding run |
| Runtime package contract | 3/3 PASS |
| Electron product build with public auth configuration | PASS; build metadata source SHA matches the packaged product source and `dirty=false` |
| `git diff --check` | PASS |
| Lint | NOT RUN; no dedicated lint script |
| Actual Electron renderer GUI | Palette, Dock, Workspace, six modules and settings captured; 980×700 Workspace and Purchase horizontal overflow 0 px |
| Packaged ASAR | Main, Preload, Palette and Workspace, account config and tray present; compiled test files 0 |
| New Portable | Actual Windows launch PASS: two Palette windows, three default widgets and one Dock on primary display |
| Packaged `win-unpacked` app | Palette and Workspace launch PASS from the packaged ASAR; isolated QA profile |
| Complex real wallpaper and desktop icon text behind the new cards | CONDITIONAL; computed opacity and synthetic backdrop comparison checked, but no privacy-safe unobstructed physical desktop capture |
| NSIS installation, beta.2 replacement, external distribution | NOT RUN by design |

The first focused run found one old test expecting `ELECTRON LOCAL`. The product now correctly says `이 PC에서 작성`; the expectation was updated and that test file passed 8/8 on rerun. This was an assertion change caused by the approved copy change, not a product runtime failure.

## Candidate artifacts

F: candidate directory: `F:\BOGUNON_DEV\design-polish-cream-bento-candidate`.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `release/BOGUNON-DESK-2.0.0-beta.3-win-x64.exe` | 195,462,023 | `D4C0DDE2E630DAF81EC49A8AE2051143806645BA877B63FE791684B2F9AC2A5E` |
| `release/BOGUNON-DESK-Setup-2.0.0-beta.3-x64.exe` | 214,021,208 | `B8D370F1186443B94B4A4EEA52C84A20BCB17F2CC1B6EE247DA5E2DAD4CE1F6F` |

Both are unsigned internal QA files. `SHA256SUMS.txt` is beside the files. The configured Windows appId, productName, user profile name and per-user NSIS settings were retained. The installed beta.2 was neither replaced nor removed.

## Evidence and review limits

The pre-polish installed beta.2 screenshots and contact sheet are in `F:\BOGUNON_DEV\design-final-review-20261120`. New isolated Electron screenshots, `design-before-after.png`, test/build logs, result JSON and `evidence-manifest.csv` are in `F:\BOGUNON_DEV\design-polish-cream-bento-qa`. The contact sheet labels the old installed app and the new isolated build separately. Its Palette comparison uses a synthetic mint backing to make transparency visible; it is not evidence of a real wallpaper hit test. The packaged Palette and Workspace screenshots are in the candidate directory.

The user must review the new design before approval. A privacy-safe real desktop comparison on a cluttered wallpaper and a beta.2 → beta.3 installation/update test are still required before external distribution. Do not treat prior beta.2 functionality QA as beta.3 design approval.

## Protection and next step

The installed beta.2 EXE SHA remained `DFEDC2FB28E2AD51E41E8904DA39D82167F7520DF704B2BE9395D1D94B13462C`. The installed app remained running. QA used F: profiles and all candidate QA processes were closed; no real user data or authentication state was copied. Other worktrees were not modified. The new source branch was pushed independently; it was not merged to main.

Next: have the user compare the images and, if desired, inspect the candidate on an unobstructed actual desktop. After explicit design and install approval, perform a beta.2 → beta.3 update test using a full backup, then decide whether to replace the limited beta file. No current Google Drive participant file was changed.
