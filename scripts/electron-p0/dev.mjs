import { spawn,execFileSync } from 'node:child_process';
execFileSync(process.execPath,['scripts/electron-p0/build.mjs'],{stdio:'inherit'});
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','electron-p0/vite.config.ts'],{stdio:'inherit'});
let electron;
const stop=()=>{electron?.kill();vite.kill()};process.on('SIGINT',stop);process.on('SIGTERM',stop);
try{
 const until=Date.now()+20000;
 while(true){try{const r=await fetch('http://127.0.0.1:5174/');if(r.ok)break}catch{}if(Date.now()>until)throw Error('PoC Vite did not start');await new Promise(r=>setTimeout(r,200))}
 const binary=(await import('electron')).default;
 electron=spawn(binary,['build/electron-p0-app'],{stdio:'inherit',env:{...process.env,ELECTRON_P0_DEV_URL:'http://127.0.0.1:5174/'}});
 electron.on('exit',code=>{vite.kill();process.exitCode=code??1});
}catch(error){stop();throw error}
