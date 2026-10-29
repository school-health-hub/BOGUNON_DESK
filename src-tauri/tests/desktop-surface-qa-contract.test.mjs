import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("production Tauri identity remains unchanged", () => {
  const production = JSON.parse(read("tauri.conf.json"));
  assert.equal(production.identifier, "kr.sungandi.schoolhealthdesk");
  assert.equal(production.productName, "BOGUNON DESK");
});

test("desktop Surface QA flavor is isolated and has no production integrations", () => {
  const qa = JSON.parse(read("tauri.desktop-surface-qa.conf.json"));
  assert.equal(qa.identifier, "kr.sungandi.schoolhealthdesk.surfaceqa");
  assert.equal(qa.mainBinaryName, "bogunon-desk-surface-qa");
  assert.equal(qa.build.frontendDist, "../dist-surface-qa-main");
  assert.equal(qa.app.windows.length, 1);
  assert.equal(qa.app.windows[0].label, "main");
  assert.equal(qa.app.windows[0].create, false);
  assert.match(qa.app.windows[0].title, /SYNTHETIC ONLY/);
  assert.deepEqual(qa.plugins, { updater: null, "deep-link": null });
  assert.equal(qa.bundle.active, false);

  const serialized = JSON.stringify(qa);
  for (const forbidden of ["supabase", "oauth", "autostart", "school-health-desk://"]) {
    assert.equal(serialized.toLowerCase().includes(forbidden), false, forbidden);
  }

  const capabilities = qa.app.security.capabilities;
  assert.equal(capabilities.length, 1);
  assert.deepEqual(capabilities[0].permissions, []);
});

test("native QA entrypoint has an explicit minimal boundary", () => {
  const cargo = read("Cargo.toml");
  const entrypoint = read("src/desktop_surface_qa.rs");
  const build = read("build.rs");
  const runtime = read("src/surface_runtime.rs");

  assert.ok(cargo.includes('desktop-surface-qa = ["tauri/custom-protocol", "dep:webview2-com"]'));
  assert.match(entrypoint, /navigation::begin/);
  assert.doesNotMatch(
    entrypoint,
    /tauri_plugin_(?:updater|deep_link|autostart|store|dialog|opener|single_instance)/,
  );
  assert.doesNotMatch(entrypoint, /supabase|oauth|my_finance/i);
  const handler = entrypoint.match(/invoke_handler\(tauri::generate_handler!\[([\s\S]*?)\]\)/);
  assert.ok(handler, "QA edit command handler is missing");
  const commands = [...handler[1].matchAll(/main_commands::([a-z_]+)/g)].map((match) => match[1]);
  assert.deepEqual(commands, [
    "begin_desktop_surface_edit",
    "complete_desktop_surface_edit",
    "cancel_desktop_surface_edit",
  ]);
  assert.match(build, /CARGO_FEATURE_DESKTOP_SURFACE_QA/);
  assert.match(build, /AppManifest::new\(\)/);
  assert.match(runtime, /pub fn launch_desktop_surface_qa/);
  assert.match(runtime, /pub fn launch_qa_surface[\s\S]*qa_launch_requested/);
  assert.doesNotMatch(entrypoint, /set_var|remove_var|BOGUNON_DESKTOP_SURFACE_QA/);
});

test("QA Main startup failures are diagnosed without panic-abort", () => {
  const entrypoint = read("src/desktop_surface_qa.rs");
  const lib = read("src/lib.rs");
  const diagnostic = read("src/qa_main_startup_diagnostic.rs");
  const runtime = read("src/surface_runtime.rs");

  assert.doesNotMatch(entrypoint, /\.expect\("error while running isolated Desktop Surface QA"\)/);
  assert.match(entrypoint, /QaMainStartupDiagnostic/);
  assert.match(entrypoint, /process::exit/);
  assert.match(lib, /mod qa_main_startup_diagnostic/);
  assert.match(diagnostic, /bogunon-desktop-surface-qa-main-diagnostic\.json/);
  assert.match(diagnostic, /HostExitedBeforeGrant/);
  assert.match(runtime, /classify_child_before_grant/);
  assert.match(runtime, /HostExitedBeforeGrant/);
  assert.match(entrypoint, /SecurityCallerInstallFailed/);
  assert.match(entrypoint, /InstallError::Lifetime\(error\)/);
  assert.match(entrypoint, /LifetimeStateMissing/);
  assert.match(entrypoint, /LifetimeOriginMismatch/);
  assert.match(entrypoint, /LifetimeResourceRegistrationFailed/);
  assert.match(entrypoint, /SecurityEventsInstallFailed/);
  assert.match(read("src/qa_main_navigation.rs"), /app\.exit\(7\)/);
  assert.doesNotMatch(entrypoint, /main_security::install\(app\.handle\(\)\)\.map_err/);
});

test("QA origin diagnostics observe the admission read without changing security ordering", () => {
  const lifetime = read("src/main_lifetime.rs");
  const entrypoint = read("src/desktop_surface_qa.rs");
  const diagnostic = read("src/qa_main_startup_diagnostic.rs");
  assert.ok(entrypoint.includes("builder.manage(diagnostic.clone())"));
  assert.ok(lifetime.includes("origin_reading(&current_url, allowed)"));
  assert.ok(diagnostic.includes("main_origin_state: Option<MainOriginState>"));
  assert.ok(lifetime.indexOf("origin_reading(&current_url, allowed)") < lifetime.indexOf("if !allowed {"));
  const continuation = read("src/qa_main_navigation_continue.rs");
  assert.ok(continuation.includes("main_security::install_after_caller_observed"));
  assert.ok(continuation.includes("gate.claim(Instant::now(), identity_ok, origin_ok)"));
});

test("QA initial navigation is subscribed once before the first app navigation", () => {
  const bootstrap = read("src/qa_main_navigation.rs");
  const native = read("src/qa_main_navigation_native.rs");
  const continuation = read("src/qa_main_navigation_continue.rs");
  assert.ok(bootstrap.indexOf("native::attach(") < bootstrap.indexOf("main.navigate(url)"));
  assert.equal((bootstrap.match(/main\.navigate\(/g) ?? []).length, 1);
  assert.ok(bootstrap.includes("wait_timeout(gate, remaining)"));
  assert.ok(native.includes("args.IsSuccess(&mut success)"));
  assert.ok(native.includes("args.NavigationId(&mut id)"));
  assert.ok(native.includes("remove_NavigationStarting"));
  assert.ok(native.includes("remove_NavigationCompleted"));
  assert.ok(continuation.includes("native::detach_completed"));
  assert.ok(continuation.indexOf("prepare(main, bootstrap)") < continuation.indexOf("gate.finish()"));
  assert.ok(continuation.indexOf("gate.finish()") < continuation.indexOf("surface_runtime::launch_desktop_surface_qa"));
  for (const code of [bootstrap, native, continuation]) {
    assert.doesNotMatch(code, /thread::sleep|sleep\(|\.reload\(|\.eval\(/);
  }
});
