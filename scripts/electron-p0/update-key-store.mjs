import {createCipheriv,createDecipheriv,createHash,createPrivateKey,createPublicKey,randomBytes,scryptSync} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

const powershell=join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
export const defaultSigningStore=()=>join(process.env.LOCALAPPDATA??'', 'BOGUNON-DESK-UPDATE-SIGNING','ed25519.dpapi');
const runPowerShell=(script,input='',visible=false)=>{
  try{return execFileSync(powershell,['-NoProfile','-NonInteractive','-STA','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{input,encoding:'utf8',windowsHide:!visible,maxBuffer:16384,stdio:['pipe','pipe','pipe']});}
  catch{throw new Error('Windows 사용자 보호 저장소를 열지 못했습니다.');}
};
const protectScript=`$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Security;$bytes=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd());$secret=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Convert]::ToBase64String($secret))`;
const unprotectScript=`$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Security;$secret=[Convert]::FromBase64String([Console]::In.ReadToEnd());$bytes=[Security.Cryptography.ProtectedData]::Unprotect($secret,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Text.Encoding]::UTF8.GetString($bytes))`;
export const protectForWindowsUser=privatePem=>runPowerShell(protectScript,privatePem).trim();
export const unprotectForWindowsUser=blob=>runPowerShell(unprotectScript,blob);
export const publicFingerprint=privatePem=>createHash('sha256').update(createPublicKey(createPrivateKey(privatePem)).export({type:'spki',format:'der'})).digest('hex');
export const publicPem=privatePem=>createPublicKey(createPrivateKey(privatePem)).export({type:'spki',format:'pem'}).toString();
export function encryptRecoveryBackup(privatePem,passphrase){
  if(passphrase.length<16)throw new Error('복구 암호는 16자 이상이어야 합니다.');
  const salt=randomBytes(16),iv=randomBytes(12);
  const key=scryptSync(passphrase,salt,32,{N:1<<17,r:8,p:1,maxmem:256*1024*1024});
  const cipher=createCipheriv('aes-256-gcm',key,iv);
  const ciphertext=Buffer.concat([cipher.update(privatePem,'utf8'),cipher.final()]);
  key.fill(0);
  return {schema:1,kdf:'scrypt',N:1<<17,r:8,p:1,salt:salt.toString('base64'),cipher:'aes-256-gcm',iv:iv.toString('base64'),ciphertext:ciphertext.toString('base64'),tag:cipher.getAuthTag().toString('base64'),fingerprint:publicFingerprint(privatePem)};
}
export function decryptRecoveryBackup(backup,passphrase){
  if(!backup||backup.schema!==1||backup.kdf!=='scrypt'||backup.N!==1<<17||backup.r!==8||backup.p!==1||backup.cipher!=='aes-256-gcm')throw new Error('지원하지 않는 복구 백업입니다.');
  const salt=Buffer.from(backup.salt,'base64'),iv=Buffer.from(backup.iv,'base64'),tag=Buffer.from(backup.tag,'base64');
  if(salt.length!==16||iv.length!==12||tag.length!==16||typeof backup.ciphertext!=='string'||!/^[a-f0-9]{64}$/.test(backup.fingerprint))throw new Error('복구 백업 형식이 올바르지 않습니다.');
  const key=scryptSync(passphrase,salt,32,{N:1<<17,r:8,p:1,maxmem:256*1024*1024});
  try{
    const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);
    const privatePem=Buffer.concat([decipher.update(Buffer.from(backup.ciphertext,'base64')),decipher.final()]).toString('utf8');
    if(publicFingerprint(privatePem)!==backup.fingerprint)throw new Error('복구 백업 지문이 다릅니다.');
    return privatePem;
  }finally{key.fill(0);}
}
export async function readProtectedSigningKey(path=defaultSigningStore()){
  const privatePem=unprotectForWindowsUser(await readFile(path,'utf8'));
  if(createPrivateKey(privatePem).asymmetricKeyType!=='ed25519')throw new Error('업데이트 서명 키 형식이 올바르지 않습니다.');
  return privatePem;
}
export function promptRecoveryPassphrase(confirm){
  const script=`
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$form=New-Object System.Windows.Forms.Form
$form.Text='BOGUNON 업데이트 키 복구 암호'
$form.Width=440;$form.Height=220;$form.StartPosition='CenterScreen';$form.TopMost=$true
$label=New-Object System.Windows.Forms.Label;$label.Text='복구 암호를 입력하세요 (16자 이상). 채팅이나 로그에 입력하지 마세요.';$label.Left=18;$label.Top=20;$label.Width=390
$first=New-Object System.Windows.Forms.TextBox;$first.Left=18;$first.Top=55;$first.Width=390;$first.UseSystemPasswordChar=$true
$second=New-Object System.Windows.Forms.TextBox;$second.Left=18;$second.Top=88;$second.Width=390;$second.UseSystemPasswordChar=$true;$second.Visible=${confirm?'$true':'$false'}
$button=New-Object System.Windows.Forms.Button;$button.Text='확인';$button.Left=308;$button.Top=125;$button.Width=100
$button.Add_Click({if($first.Text.Length -lt 16 -or (${confirm?'$true':'$false'} -and $first.Text -cne $second.Text)){[System.Windows.Forms.MessageBox]::Show('16자 이상 암호와 확인 입력을 점검하세요.');return};$form.DialogResult='OK';$form.Close()})
$form.Controls.AddRange(@($label,$first,$second,$button));$form.AcceptButton=$button
if($form.ShowDialog() -ne 'OK'){exit 2}
[Console]::Out.Write([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($first.Text)))
`;
  const encoded=runPowerShell(script,'',true).trim();
  return Buffer.from(encoded,'base64').toString('utf8');
}
