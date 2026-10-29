import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Given no NASM on PATH, When CI provisions a portable copy, Then official archive and executable hashes precede execution', () => {
  const workflow = read('.github/workflows/finder-home-qa-windows.yml');
  const setup = workflow.split('name: Prepare verified NASM 2.16.03')[1]?.split('      - name:')[0];
  assert.ok(setup, 'Pinned NASM setup must precede prerequisite verification');
  assert.match(setup, /https:\/\/www\.nasm\.us\/pub\/nasm\/releasebuilds\/2\.16\.03\/win64\/nasm-2\.16\.03-win64\.zip/);
  assert.match(setup, /3ee4782247bcb874378d02f7eab4e294a84d3d15f3f6ee2de2f47a46aa7226e6/);
  assert.match(setup, /a93276636266516421cc9b422f47476c21f7a2949f1ae251556b2f1d33a3be04/);
  assert.match(setup, /MaximumRedirection 0/);
  assert.ok(setup.indexOf('NASM executable checksum mismatch') < setup.indexOf('& $nasm -v'));
  assert.match(setup, /GITHUB_PATH/);
  assert.match(setup, /GITHUB_ACTIONS/);
  assert.doesNotMatch(setup, /choco install|setx|Start-Process|--version latest/);
});

test('Given synthetic tool metadata, When provisioning selects reuse or download, Then checksum failures stop before any executable runs', () => {
  const workflow = read('.github/workflows/finder-home-qa-windows.yml').replaceAll('\r\n', '\n');
  const step = workflow.split('      - name: Prepare verified NASM 2.16.03\n')[1].split('      - name:')[0];
  const body = step.split('        run: |\n')[1].split('          $version =')[0]
    .split('\n').map(line => line.slice(10)).join('\n');
  for (const mode of ['existing', 'download', 'badArchive', 'badExe']) {
    // All filesystem/network/tool probes below are synthetic in the child shell.
    // The real NASM version/execution statement is deliberately excluded.
    const mock = `
$env:GITHUB_ACTIONS='true'; $env:RUNNER_OS='Windows'
$env:RUNNER_TEMP=[IO.Path]::GetTempPath(); $env:ProgramFiles='C:/synthetic'
$env:GITHUB_RUN_ID='1'; $env:GITHUB_RUN_ATTEMPT='1'
$mode='${mode}'; $script:downloads=0
function Get-Command { param($Name,$CommandType,$ErrorAction) if($mode -eq 'existing'){[pscustomobject]@{Source='C:/synthetic/nasm.exe'}} }
function Test-Path { param($LiteralPath,$PathType) return ($mode -eq 'existing' -and $LiteralPath -eq 'C:/synthetic/nasm.exe') }
function Get-FileHash { param($LiteralPath,$Algorithm)
  $hash='a93276636266516421cc9b422f47476c21f7a2949f1ae251556b2f1d33a3be04'
  if($LiteralPath -like '*.zip'){$hash='3ee4782247bcb874378d02f7eab4e294a84d3d15f3f6ee2de2f47a46aa7226e6';if($mode -eq 'badArchive'){$hash='wrong'}}
  elseif($mode -eq 'badExe'){$hash='wrong'}
  [pscustomobject]@{Hash=$hash}
}
function New-Item { param($ItemType,$Path,$ErrorAction) }
function Invoke-WebRequest { param($Uri,$MaximumRedirection,$TimeoutSec,$OutFile) $script:downloads++ }
function Expand-Archive { param($LiteralPath,$DestinationPath,$ErrorAction) }
try {
${body}
  if($mode -eq 'badArchive' -or $mode -eq 'badExe'){throw 'Expected checksum rejection'}
  if(($mode -eq 'existing' -and $script:downloads -ne 0) -or ($mode -eq 'download' -and $script:downloads -ne 1)){throw 'Wrong provisioning branch'}
} catch {
  if(($mode -eq 'badArchive' -and $_.Exception.Message -eq 'NASM archive checksum mismatch') -or ($mode -eq 'badExe' -and $_.Exception.Message -eq 'NASM executable checksum mismatch')){exit 0}
  Write-Error $_;exit 1
}
`;
    const result = spawnSync('pwsh', ['-NoProfile', '-Command', mock], { encoding: 'utf8', timeout: 15000, windowsHide: true });
    assert.equal(result.status, 0, `${mode}: ${result.stdout} ${result.stderr}`);
  }
});

test('Given CI workflow, When reviewed offline, Then only manual isolated build and explicit artifact files are configured', () => {
  const workflow = read('.github/workflows/finder-home-qa-windows.yml');
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+(push|pull_request|schedule|workflow_run):/m);
  assert.match(workflow, /runs-on: windows-2022/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /node-version: '22\.23\.3'/);
  assert.match(workflow, /toolchain: '1\.98\.1'/);
  assert.match(workflow, /retention-days: 7/);
  assert.doesNotMatch(workflow, /secrets\.|environment:|Start-Process|release:|npm run build/);
  const artifact = workflow.split('name: Upload only executable and provenance')[1];
  assert.ok(artifact);
  assert.equal((artifact.match(/\/artifact\//g) ?? []).length, 3);
  assert.doesNotMatch(artifact, /\*|target|webview|\.env/);
});

test('Given build script, When source or checkout differs, Then fail-closed guards precede compilation and no executable is launched', () => {
  const source = read('scripts/build-finder-home-qa-ci.mjs');
  assert.match(source, /git\(\['rev-parse', 'HEAD'\]\) !== expected/);
  assert.match(source, /--locked.*--offline/);
  assert.match(source, /finder-home-qa,tauri\/custom-protocol/);
  assert.match(source, /sha256/);
  assert.doesNotMatch(source, /^run\(executable|Start-Process|--bundles|release:|--release/m);
});

test('Given portable Native entry, When built on a different PC, Then runtime has no compiled runner path dependency', () => {
  const source = read('src-tauri/src/finder_home_qa.rs');
  assert.match(source, /std::env::var\("BOGUNON_FINDER_HOME_QA_RUNTIME_ROOT"\)/);
  assert.doesNotMatch(source, /env!\("CARGO_MANIFEST_DIR"\)|env!\("BOGUNON_FINDER_HOME_QA_OUTPUT_ROOT"\)/);
  const paths = read('src-tauri/src/finder_home_qa_paths.rs');
  assert.match(paths, /create_new\(true\)/);
  assert.match(paths, /owner\["sourceSha"\] != self.source_sha/);
  assert.doesNotMatch(paths, /projectRoot|project_root|app_local_data_dir|std::env::var\("APPDATA"\)/);
});
