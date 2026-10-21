# BOGUNON DESK v1.0 integrated Windows QA

## Fixed test subject

- Source: `0807f2e7ee12780795df1b6d4b0fe3c5e2da593b`
- Contents: merged MY FINANCE Phase 2 plus approved v1.0 dashboard
- Package: approved `MY-FINANCE-QA-TESTABLE-0807f2e7ee12780795df1b6d4b0fe3c5e2da593b`
- Identity: `BOGUNON DESK MY FINANCE QA`; production identity and production updater are out of scope

Do not install an internal Candidate artifact. Before use, complete every metadata, approval, inventory and hash check in `MY_FINANCE_TESTABLE_PUBLICATION.md`. Record the new run, attempt, controller SHA, Candidate artifact ID, TESTABLE artifact ID, transfer-manifest SHA-256 and installer SHA-256. Earlier Phase 1 or Phase 2 approvals do not authorize this package.

## Minimum manual QA

Use synthetic data only. Record each row as PASS, FAIL or NOT TESTED with the Windows version, WebView2 version, display resolution and scale.

| Area | Procedure | Required observation |
| --- | --- | --- |
| Clean install | On an isolated Windows user or approved QA PC, verify the installer hash and perform a current-user install. Launch from the Start menu. | QA product name, QA install directory and QA AppData identifier are used; production installation and data metadata are unchanged. |
| In-place QA update | With the previously approved QA build installed, capture QA and production AppData metadata, then install this exact package over the QA app. | Existing Phase 1 and Phase 2 synthetic records remain after launch and one normal close/relaunch. No production updater or production identifier is invoked. |
| Dashboard | At 1366x768, 1600x900 and a 1920-class maximized window, inspect the approved dashboard. Repeat at 100%, 125% and 150% Windows scale where supported. | No clipped Korean text, horizontal overflow, unnecessary page scroll, large blank gap or Dock/widget overlap; right rail and Quick Launcher remain visible where specified by the approved layout. |
| Desktop regressions | Open/close Settings and Quick Memo; use Dock actions; check tray reopen and close-to-tray; launch a second instance; exercise file drop with a synthetic file; open Purchase Helper, Official Document and Record Helper. | Each surface opens once and remains interactive; no fatal console/runtime error or operating-data access occurs. |
| Finance preservation | Compare the already verified synthetic Phase 1/Phase 2 counts and totals before and after update/relaunch. Open tax, investment and asset views without recreating the full Phase 2 scenario. | Existing income, withholding, trades, dividend, assets and liabilities remain identical; realized and unrealized gains stay distinct. |
| Encrypted backup | Create a new `.bgfnbk` from the integrated synthetic dataset, record its SHA-256, reject one wrong password, then validate the correct password. | Existing data remains unchanged; no plaintext export is produced. Actual restore is NOT TESTED unless separately authorized. |
| Runtime boundary | While the QA app is running, verify its executable path, package identity and QA Local/Roaming AppData paths. | Codex LocalCache and production AppData are not used or modified. |

Stop immediately on an unexpected elevation request, security-product block, production repair/update screen, identity/path mismatch, data loss, response hang or hash mismatch. Do not retry installation, restore data or bypass policy automatically.

## Evidence and release boundary

Save non-sensitive screenshots and metadata only. Never record backup passwords, DPAPI material, database contents or real financial data. The approved TESTABLE is a manual QA package, not a production release candidate. Production signing, production installer/update testing and formal release publication remain separate approval-gated work after this checklist passes.
