import {execFileSync} from 'node:child_process';
// Generate fixtures in this worktree using the original Rust contract tests.
// Do not copy another worktree's binaries/fixtures or silently skip CLI tests.
for(const [operation,manifest] of [
 ['test','tools/purchase-excel-cli/Cargo.toml'],
 ['build','tools/purchase-excel-cli/Cargo.toml'],
 ['build','tools/official-document-cli/Cargo.toml'],
 ['test','tools/record-helper-cli/Cargo.toml'],
])execFileSync('cargo',[operation,'--locked','--manifest-path',manifest],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/electron-p0/build-record.mjs'],{stdio:'inherit'});
