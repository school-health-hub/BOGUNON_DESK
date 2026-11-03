# Inherited channel provenance

`upstream/{main_restore.rs,edit_control.rs,memory_channel.rs}` are byte-preserved copies from `school-health-hub/BOGUNON_DESK` commit `e4dfcbf7b987039b093d3d1dbb8bed69a3bfcc6e`, path `src-surface-protocol/`. Existing project copyright/license applies. No original Tauri or Native worktree is modified.

The standalone binary reuses the bounded little-endian memory framing, capability binding, OpenMain request and RestoreResponse. It implements only an authenticated restore-channel roundtrip and graceful EOF exit. OpenMain retains its restore-request meaning; it is not repurposed as a Native attachment/shutdown command. EOF closes the private inherited channel. There is no new Shell/Window protocol, Win32/WebView dependency or Native resource cleanup claim.
