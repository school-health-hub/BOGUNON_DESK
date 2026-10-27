# S-2H-17 — success-aware initial navigation bootstrap

Baseline: `7dad02a2480696d54d5964f19fa4696a77e21a03`.
S-2H-16 observed `initial_navigation_pending` with `embeddedAppMode: true`
and the expected source SHA at the lifetime admission read.

## Public API and ordering

Pinned Tauri 2.11.5 / Wry 0.55.1 maps WebView2 NavigationCompleted to
PageLoad Finished without checking its IsSuccess argument. Finished alone
cannot establish successful navigation. A setup-time subscription after an
already started navigation could also miss completion entirely.

Only the isolated QA configuration changes: Main has `create: false` and
the QA bootstrap explicitly creates that single configured Window/WebView
using a cloned configuration with a fixed empty bootstrap URL. Tauri's
pinned runtime skips Navigate for this blank URL. No blank origin is admitted.
All configured Main size/title/profile settings remain in the cloned config.
There is no second Main, reload, retry or second app navigation.

The bootstrap then:

1. Pins MainCallerGuard against the actual Window/WebView resource tables.
   Lifetime admission is still closed, so OpenMain/commands cannot proceed.
2. Uses public `with_webview` to register WebView2 NavigationStarting and
   NavigationCompleted before starting the first app navigation exactly once.
   The existing locked webview2-com 0.38.2 becomes a direct optional QA-only
   dependency; no package version changes are required.
3. Correlates the nonzero NavigationId and requires IsSuccess to be true.
   Same-ID redirects remain subject to the existing origin navigation guard;
   a changed/overlapping ID, missing args, getter error or duplicate fails closed.
4. Queues a continuation outside the COM callback. Rechecks the actual URL
   using the unchanged exact-origin predicate and rechecks Caller resource
   identity against the captured Main and current registered Main.
5. Installs Lifetime, then MainEvents. NavigationStarting stays registered
   through revalidation and installation, preventing an intervening navigation
   from being mistaken for the completed navigation.
6. Removes bootstrap subscriptions on the owning UI apartment, activates the
   one-shot gate, rechecks lifetime/identity, and only then starts the Host.
   Existing production startup continues using the shared full installer.

## Deadline and controlled failure

- One monotonic 30-second navigation budget covers QA Main creation,
  subscription, navigation completion and queued URL/identity revalidation.
- A Condvar deadline watcher wakes on state changes; there is no polling sleep
  or fixed delay. Claiming the validated installation ends this budget.
- Callback-detachment acknowledgement on a worker has a separate 2-second
  bound. Neither a COM callback nor the UI thread waits for this acknowledgement.
- Existing Host grant/launch timeouts are separate and unchanged. This is not
  a claim of a hard OS-wide process-termination bound for a hung UI/COM runtime.
- Navigation failure, timeout, wrong origin/identity, duplicate, missing
  resources, subscription/getter/removal failure prevent Host admission and
  request controlled exit 7. First fixed diagnostic failure remains preserved.
- Event tokens are recorded only after successful registration and consumed
  once on the same captured WebView. Partial registration is cleaned as well.
  COM interfaces stay on the UI apartment; only primitive state/tokens cross
  threads. No unsafe Send/Sync implementation or raw URL logging is added.
- If creation of the continuation worker itself fails, no recursive COM
  cleanup is attempted inside its callback. The fixed unsubscribe failure
  requests exit with Host blocked; cleanup on this terminal path is unconfirmed.

## Verification boundary

- Pure state tests cover pending/completion, deadline, failed navigation,
  identity/origin mismatch, duplicates, stale IDs and Host admission.
- Existing Caller and full security-order tests remain; shared deferred-tail
  tests require Lifetime → Events → Host and suppress Host after either failure.
- Source contracts require the registration-before-navigation ordering, a
  single navigation call, success/ID getters, token removal and no sleep/reload.
- Scoped rustfmt, diff and locked dependency checks are required before push.
- Windows CI performs actual Tauri all-target check, library tests, builds and
  portable package verification. Source contracts and pure tests do not prove
  callback ordering or COM cleanup at runtime.
- Only stable Rust is installed locally. Miri/sanitizer verification of the
  Windows COM boundary is NOT_VERIFIED; no new toolchain is installed. No
  actual GUI/WebView2/Host execution is performed in this task.
- A separately approved single user-session GUI run must verify the new
  initial_navigation stage and subsequent Lifetime, Events, Host and widgets.
