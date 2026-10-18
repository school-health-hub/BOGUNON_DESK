#!/usr/bin/env bash
# Compile-only negative checks. No application or Native binary is run.
set -eu
root=$(git rev-parse --show-toplevel)
output=${1:?Provide an external evidence directory}
mkdir -p "$output"
module="$root/src-tauri/src/surface_broker/mod.rs"
check() {
  name=$1
  diagnostic=$2
  if rustc --edition=2021 --crate-type=lib "$output/$name.rs" -o "$output/$name.rlib" > "$output/$name.log" 2>&1; then
    echo "Unexpected compile success: $name" >&2
    exit 1
  fi
  rg -q "$diagnostic" "$output/$name.log"
}
cat > "$output/projection-fields.rs" <<RUST
#[path = "$module"] mod broker;
fn forbidden() { let _ = broker::Projection { revision: 1, title: "secret" }; }
RUST
check projection-fields E0560
cat > "$output/synthetic-native.rs" <<RUST
#[path = "$module"] mod broker;
fn native(_: broker::CleanupReceipt<broker::TauriObserved>) {}
fn forbidden() {
    let mut registry = broker::Registry::synthetic();
    registry.retiring().unwrap();
    native(registry.confirm_synthetic_cleanup().unwrap());
}
RUST
check synthetic-native E0308
cat > "$output/foreign-proof.rs" <<RUST
#[path = "$module"] mod broker;
struct NativeQaProof;
fn forbidden(registry: &mut broker::Registry<broker::Synthetic>, proof: NativeQaProof) {
    registry.replace(proof);
}
RUST
check foreign-proof E0308
printf '3 compile-fail type boundaries passed\n'
