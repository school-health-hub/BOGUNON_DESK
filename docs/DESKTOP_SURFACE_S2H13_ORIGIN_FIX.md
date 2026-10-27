# S-2H-13 — portable QA origin mode

## Observed failure and confirmed cause

The S-2H-12 user-launched QA Main stopped at `security_lifetime_install`
with `lifetime_origin_mismatch`. Caller installation completed; the Host
was not started. No actual initial URL was captured, so an `about:blank`
navigation race is not established by that observation.

The portable workflow builds directly with Cargo and
`--features desktop-surface-qa`, rather than the Tauri CLI. Previously this
feature was empty. Locked Tauri 2.11.5 defines `is_dev()` as the inverse of
its `custom-protocol` feature, independently of Cargo's release profile.
Without that feature, `main_lifetime::local()` selects the development URL
branch. The isolated QA configuration has `devUrl: null`, so that branch
rejects every URL. This is a deterministic build-mode mismatch.

## Minimal correction and preserved boundaries

Only the QA feature now enables `tauri/custom-protocol`, selecting embedded
assets and the existing embedded-origin policy. Default and Finance QA
features, dependencies, lockfiles, Tauri configuration, identifiers and
origin matching logic are unchanged. No new origin is allowed.

Caller → Lifetime → Events installation order remains unchanged. Any
installation error still exits before Host launch. Duplicate installation,
resource identity checks and navigation retirement remain in place.

## Regression evidence

- The QA Cargo-feature contract failed before the feature correction.
- After correction, 15 focused Node contracts passed:
  `node --test src-tauri/tests/desktop-surface-qa-contract.test.mjs scripts/desktop-surface-s2f1-portable-qa-contract.test.mjs scripts/surface-qa-frontend-contract.test.mjs`.
- `cargo tree --manifest-path src-tauri/Cargo.toml --locked --offline --features desktop-surface-qa -e features -i tauri`
  resolves `tauri/custom-protocol` through `desktop-surface-qa`.
- A feature-gated Rust regression asserts `!tauri::is_dev()` for the actual
  linked QA build. Existing exact-origin rejection cases now include
  `about:blank`. These Rust tests require the Windows CI result; they were
  not locally compiled as part of the lightweight check.
- Scoped rustfmt and `git diff --check` passed.

## Windows validation boundary

The existing branch-push portable QA workflow performs Windows Cargo check,
library tests, build and package verification without executing QA Main or
the Host. Its result and artifact provenance must be checked for the new
checkpoint, independently of earlier successful builds.

Actual GUI startup, Main Lifetime initialization, six-widget rendering,
Quick Launcher and runtime cleanup remain NOT_VERIFIED until a separately
approved single user-session execution of the new package. If a timing
failure remains, investigate it without admitting transient or foreign
origins and without starting the Host before security installation.
