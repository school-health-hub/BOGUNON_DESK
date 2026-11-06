$ErrorActionPreference='Stop'
# Reuse only the immutable Windows native payload; all changed TS/CSS is rebuilt.
git diff --exit-code 39c775cdd11509fdc6bc930ef62990acdd1e1315 HEAD -- tools src-tauri
if($LASTEXITCODE -ne 0){throw 'Native source changed; payload reuse forbidden'}
$prior=@(Get-ChildItem "$env:TD2_ROOT/prior-portable/*.exe")
if($prior.Count -ne 1 -or (Get-FileHash $prior[0].FullName -Algorithm SHA256).Hash.ToLowerInvariant() -cne '7cb0dc89cc967db9d687bc0f385451f740c21d11d7959f5b4f39aa710a1fdefa'){throw 'Native origin Portable mismatch'}
7z x $prior[0].FullName "-o$env:TD2_ROOT/prior-container" -y | Out-Null
if($LASTEXITCODE -ne 0){throw 'Native origin extraction failed'}
$archive=@(Get-ChildItem "$env:TD2_ROOT/prior-container" -Recurse -Filter app-64.7z)
if($archive.Count -ne 1){throw 'Ambiguous app archive'}
7z x $archive[0].FullName "-o$env:TD2_ROOT/prior-app" -y | Out-Null
if($LASTEXITCODE -ne 0){throw 'Native payload extraction failed'}
$hashes=@{
 'purchase-excel-cli'='5240026d893e6529361907915fd05ebf5498526e0bbf723a360c38fc5532175e';
 'official-document-cli'='61697e919f96bf3816f1bcf7066684c8d64d7b3a3435c188ba92fc347b23c8e0';
 'my-finance-cli'='b40175de3b7f65496674c7ebd2200d680b48f124a3933d812d5f7c09cc0992d9';
 'chatgpt-auth-cli'='5f36d7340eaf184ac88866149cc46f1765fe279044e23d8aecec4e993fc22669';
 'record-helper-cli'='e6eabcea08ef6b198e1f698dafda92a0990f30e5d2967a631865b362bfbcd3d8'
}
foreach($cli in $hashes.Keys){
 $root="$env:TD2_ROOT/prior-app/resources/$cli"
 if((Get-FileHash "$root/$cli.exe" -Algorithm SHA256).Hash.ToLowerInvariant() -cne $hashes[$cli]){throw "Native hash mismatch: $cli"}
 New-Item -ItemType Directory "build/$cli" -Force | Out-Null
 Copy-Item "$root/*" "build/$cli/" -Recurse
}
# Canonical LF source bytes preserve the existing native provenance checks.
git config --local core.autocrlf input
git config --local core.eol lf
@('src-tauri/src/record_helper_import/** text eol=lf','src-tauri/src/my_finance*.rs text eol=lf','tools/my-finance-cli/src/** text eol=lf') | Add-Content .git/info/attributes
node --input-type=module -e "import fs from 'node:fs';import{execFileSync as run}from'node:child_process';const paths=new Set([...run('git',['ls-files','src-tauri/src/record_helper_import','src-tauri/src/my_finance*','tools/my-finance-cli/src'],{encoding:'utf8'}).trim().split(/\r?\n/),...Object.keys(JSON.parse(fs.readFileSync('tools/my-finance-cli/source-hashes.json')).files)]);for(const p of paths){if(!/^(src-tauri\/src\/|tools\/my-finance-cli\/src\/)/.test(p))throw Error('Unexpected provenance path');fs.writeFileSync(p,run('git',['show','HEAD:'+p]));}"
if($LASTEXITCODE -ne 0){throw 'Canonical native provenance failed'}
git add --renormalize -- src-tauri/src/record_helper_import "src-tauri/src/my_finance*.rs" tools/my-finance-cli/src
git diff --cached --exit-code HEAD
if($LASTEXITCODE -ne 0 -or (git status --porcelain)){throw 'Build source dirty'}
npm run electron:p0:build
if($LASTEXITCODE -ne 0){throw 'Electron typecheck/build failed'}
node --input-type=module -e "import fs from'node:fs';import{parseAccountConfig}from'./build/electron-p0-app/main/account-network.js';const m=JSON.parse(fs.readFileSync('build/electron-p0-app/build-meta.json'));if(m.dirty||m.sourceSha!==process.env.GITHUB_SHA)throw Error('Source identity mismatch');const c=parseAccountConfig(JSON.parse(fs.readFileSync('build/electron-p0-app/account-config.json')));if(!c||c.origin!==JSON.parse(fs.readFileSync('config/production-supabase.json')).origin)throw Error('Public auth configuration missing');fs.writeFileSync(process.env.TD2_EVIDENCE_ROOT+'/public-auth-build.json',JSON.stringify({configured:true,keyLogged:false,networkCalled:false}));"
if($LASTEXITCODE -ne 0){throw 'Build identity/public configuration failed'}
node node_modules/vitest/vitest.mjs run electron-p0/tests/desktop-utilities-routing.test.tsx electron-p0/tests/official-ai-workflow.test.tsx electron-p0/tests/official-document-files-ui.test.tsx electron-p0/tests/purchase-settings-ui.test.tsx --reporter=json --outputFile="$env:TD2_EVIDENCE_ROOT/focused-tests.json"
if($LASTEXITCODE -ne 0){throw 'Focused regression failed'}
npx electron-builder --config electron-p0/builder.json --win portable --x64 --publish never
if($LASTEXITCODE -ne 0){throw 'Portable packaging failed'}
node --test scripts/electron-p0/runtime-package.test.mjs scripts/electron-p0/chatgpt-package.test.mjs scripts/electron-p0/record-package.test.mjs scripts/electron-p0/account-package.test.mjs
if($LASTEXITCODE -ne 0){throw 'Packaged resource contracts failed'}
node scripts/electron-p0/check-ocr-package.mjs
if($LASTEXITCODE -ne 0){throw 'OCR resource integrity failed'}
$exe=@(Get-ChildItem release-electron-p0/*.exe)
if($exe.Count -ne 1){throw 'Expected one new Portable'}
$hash=(Get-FileHash $exe[0].FullName -Algorithm SHA256).Hash.ToLowerInvariant()
"TD2_PORTABLE_EXE=$($exe[0].FullName)" >> $env:GITHUB_ENV
"TD2_EXPECTED_SOURCE_SHA=$env:GITHUB_SHA" >> $env:GITHUB_ENV
[ordered]@{sourceSha=$env:GITHUB_SHA;sha256=$hash;file=$exe[0].Name;bytes=$exe[0].Length;dirty=$false;rebuilt=$true;nativeSourceUnchanged=$true;nativeHashes=$hashes}|ConvertTo-Json -Depth 4|Set-Content "$env:TD2_EVIDENCE_ROOT/portable.json"
