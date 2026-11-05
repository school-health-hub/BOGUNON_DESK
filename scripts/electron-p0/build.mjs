import { execFileSync } from 'node:child_process';
import { mkdir,copyFile,writeFile,readFile } from 'node:fs/promises';
const run=(args)=>execFileSync(process.execPath,args,{stdio:'inherit'});
run(['scripts/electron-p0/build-ocr.mjs']);
run(['node_modules/typescript/bin/tsc','-p','electron-p0/tsconfig.json']);
run(['node_modules/typescript/bin/tsc','-p','electron-p0/tsconfig.renderer.json']);
run(['node_modules/typescript/bin/tsc','-p','electron-p0/tsconfig.tests.json']);
run(['node_modules/vite/bin/vite.js','build','--config','electron-p0/vite.account.config.ts']);
run(['node_modules/vite/bin/vite.js','build','--config','electron-p0/vite.instructor.config.ts']);
run(['node_modules/vite/bin/vite.js','build','--config','electron-p0/vite.config.ts']);
await mkdir('build/electron-p0-app',{recursive:true});
await copyFile('electron-p0/package.json','build/electron-p0-app/package.json');
const {parseAccountConfig}=await import('../../build/electron-p0-app/main/account-network.js');
const production=JSON.parse(await readFile('config/production-supabase.json','utf8'));
const {loadEnv}=await import('vite');
const authEnv=loadEnv('production',process.cwd(),'VITE_SUPABASE_');
let matchingAuthOrigin=false;try{const candidate=new URL(authEnv.VITE_SUPABASE_URL?.trim()||production.origin);matchingAuthOrigin=candidate.protocol==='https:'&&candidate.origin===production.origin&&!candidate.username&&!candidate.password;}catch{}
const accountConfig=matchingAuthOrigin?parseAccountConfig({origin:production.origin,publishableKey:authEnv.VITE_SUPABASE_PUBLISHABLE_KEY}):null;
// Only the same public anon/publishable key accepted by Tauri; never embed service-role keys.
await writeFile('build/electron-p0-app/account-config.json',JSON.stringify(accountConfig??{origin:production.origin,publishableKey:''}));
console.log(`BOGUNON public auth configuration: ${accountConfig?'available':'missing or invalid (login disabled)'}`);
const sourceSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const dirty=!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();
await writeFile('build/electron-p0-app/build-meta.json',JSON.stringify({sourceSha,dirty},null,2));

await copyFile('src-tauri/icons/32x32.png','build/electron-p0-app/tray.png');

// Retain the license for the bundled instructor XLSX worker in the existing ASAR main glob.
await copyFile('school-workspace/instructors/SHEETJS-LICENSE.txt','build/electron-p0-app/main/instructor-sheetjs-license.txt');
