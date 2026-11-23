import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const run=promisify(execFile);
const script="$s=Get-AuthenticodeSignature -LiteralPath $env:BOGUNON_UPDATE_INSTALLER; if($s.Status -eq 'Valid' -and $s.SignerCertificate){[Console]::Out.Write($s.SignerCertificate.Subject)}";

export async function verifyWindowsUpdateSignature(path:string,publisherSubject:string):Promise<boolean>{
  if(process.platform!=='win32'||!publisherSubject.startsWith('CN='))return false;
  const systemRoot=process.env.SystemRoot;
  if(!systemRoot)return false;
  try{
    const {stdout}=await run(`${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:4096,env:{...process.env,BOGUNON_UPDATE_INSTALLER:path}});
    return stdout.trim()===publisherSubject;
  }catch(error){if(error instanceof Error)return false;throw error;}
}
