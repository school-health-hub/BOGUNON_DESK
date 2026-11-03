# Remote-only restore check

Final remote checkpoint and restoration result are reported in the completion message for this branch. The immutable handoff commit supplies this document and the SHA256 manifest.

## Scope and acceptance
- Product SHA5ae2ae3e7534b68b015c34fc77c17e862d820f1c must be an ancestor of the handoff HEAD.
- Clone source must be public GitHub HTTPS, not the original checkout or its Git object alternates.
- HEAD equals the requested handoff checkpoint; working tree clean; ahead/behind0/0.
- All48evidence-inventory paths exist; public hashes match; all SHA256SUMS paths exist and match.
- Source,lockfile,three Electron tsconfigs,focused tests,build script and new CSS exist.
- No node_modules/build/Portable/profile/credentials are required for inventory review.

## Security
Public upload expressly approved by the user.36PNG files are synthetic, unchanged copies.4text files have machine paths redacted and are labeled in evidence-inventory.json, preserving original and public hashes. No browser profiles,real application/user records,Finance/DPAPI/auth material uploaded. Whole intended package and staged text files undergo strong credential-pattern checks and manual scope review; dedicated scanner unavailable. Residual risk: pattern matching/manual review cannot prove absence of every form of sensitive value.

## Status boundary
A successful fresh remote-only inventory restore establishes HANDOFF READY for continuing this SoftRose source/review task without the original PC or external drive. It does not establish that the receiving school's Node/MSVC/Windows DPI/GUI were tested, nor does it transfer unrelated Finance WIP. Those are separate prerequisites/scope boundaries described in README.md.

## Observed remote-restore finding
The first fresh Windows remote clone detected a byte-hash mismatch in evidence-inventory.json: several text files had been staged before the package's byte-preserving attributes existed. The clone correctly rejected the package. The handoff-only tracked paths were re-added with the final attributes so raw evidence bytes, including existing CRLF, are stored unchanged. The SHA inventory was regenerated; the remote verification then must recheck every file. No product source or evidence-original file was altered by this correction.

## Remote-only restoration observed PASS — 2026-11-04
Tested checkpoint: 652a40f0d9ce7bb3344598466d85dde2dea8d376, obtained by fresh HTTPS GitHub clone and a remote-only fast-forward correction, never using the original clone as an object source. All56manifest entries and48evidence records matched their published SHA-256. All required source/test/config files existed, product5ae2ae3 ancestry passed, git fsck --connectivity-only passed, objects/info/alternates absent, working tree clean, ahead/behind0/0. No dependency installation,build,app or test repetition was performed. This final record update changes documentation/hash-list only; receiving-school tool/OS checks remain manageable prerequisites.

Independent handoff audit: PASS for scoped SoftRose source/review dependencies, provenance, labelled redactions, public-upload authorization boundaries and no credential-pattern/machine-user-path findings. Dedicated secret scanner remains unavailable. Verdict: HANDOFF READY for this scoped source/review task without original PC/external drive; unrelated Finance WIP remains outside scope and unavailable remotely.
