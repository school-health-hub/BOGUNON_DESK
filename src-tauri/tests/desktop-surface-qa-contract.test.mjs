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

  assert.match(cargo, /^desktop-surface-qa = \[\]$/m);
  assert.match(entrypoint, /launch_desktop_surface_qa/);
  assert.doesNotMatch(
    entrypoint,
    /tauri_plugin_(?:updater|deep_link|autostart|store|dialog|opener|single_instance)/,
  );
  assert.doesNotMatch(entrypoint, /invoke_handler|supabase|oauth|my_finance/i);
  assert.match(build, /CARGO_FEATURE_DESKTOP_SURFACE_QA/);
  assert.match(build, /AppManifest::new\(\)/);
  assert.match(runtime, /pub fn launch_desktop_surface_qa/);
  assert.match(runtime, /pub fn launch_qa_surface[\s\S]*qa_launch_requested/);
  assert.doesNotMatch(entrypoint, /set_var|remove_var|BOGUNON_DESKTOP_SURFACE_QA/);
});
