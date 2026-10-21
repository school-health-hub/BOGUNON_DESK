# Native Phase 1 verification

## Runtime evidence

Command, run from the task Desktop worktree:

```
CARGO_BUILD_JOBS=2 cargo test --manifest-path src-tauri/education-video-harness/Cargo.toml --offline
```

Final result: command exit **0**; actual Windows test executable ran **11 tests, 11 passed, 0 failed**, finishing in 0.42 seconds. Doc tests: 0 failed. The harness includes the exact production model/store/destination source files by path, with no reimplementation. It uses isolated temporary directories, not the user's installed app data. No external calls occur.

Covered:

- Real atomic disk save/load and export round trip.
- First successful save already has a recoverable backup.
- Valid previous-generation backup recovery after corrupt JSON.
- Invalid UTF-8 and oversized primary copied byte-for-byte to quarantine before recovery.
- Both corrupt files return an error and preserve original data.
- Invalid import leaves primary unchanged.
- Unwritable backup destination prevents primary mutation.
- Existing video ID explicit save updates teacher edits without creating duplicate rows.
- Import preserves stored teacher notes and edited message for existing IDs.
- Valid JSON with unknown credential field rejected, including item-level unknown properties.
- Malformed JSON, unsupported version, duplicate IDs in one payload and unsafe URL rejected.
- Release destination ignores dev override; debug only accepts exact localhost/127.0.0.1:3000 origins.

The harness is a native module integration test, **not a Tauri IPC or packaged app run**. It emits expected dead-code warnings for the future Phase 2 destination entry point.

## Full native application limitation

Attempted:

```
cargo test --manifest-path src-tauri/Cargo.toml education_video --offline --no-default-features
cargo test --manifest-path src-tauri/Cargo.toml education_video --offline
```

The tool returned timeout while long dependency compilation continued. Logs then recorded:

1. Initial parallel compilation: existing `tauri-utils` dependency rustc terminated with `0xc0000409` / `STATUS_STACK_BUFFER_OVERRUN` and an allocation-error backtrace. This was before application code.
2. Subsequent compilation: `openssl-sys` build script exited **1**; Perl `Configure` exited **2**, because Git Bash Perl cannot locate `Locale/Maketext/Simple.pm`. This is an existing vendored OpenSSL/native toolchain prerequisite, before application module compilation.

No dependency was installed and no original repository Cargo configuration was changed. Full native app build, existing meal/weather native test execution and Tauri IPC integration remain unverified. The exact existing meal/weather source and launcher restrictions were left unchanged; only new module and command registrations were added to `lib.rs`.

Runtime log paths in this session:

- `%TEMP%/education-video-native-harness-final.log`: final 11-test success.
- `%TEMP%/education-video-native-test.log`: vendored OpenSSL/Perl dependency failure.
- `%TEMP%/education-video-native-red.log`: initial dependency compilation/resource failure; not a unit-test red receipt.
