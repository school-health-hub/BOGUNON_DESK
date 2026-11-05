/** QA-only. Never part of Electron product output or a hosted gateway. */
import{execFile}from'node:child_process';import{promisify}from'node:util';
const exec=promisify(execFile);const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'].includes(k)));
export const localDockerArgs=(platform:NodeJS.Platform=process.platform)=>platform==='win32'?['--host=npipe:////./pipe/docker_engine']:['--host=unix:///var/run/docker.sock'];
export async function sql(q:string,user='postgres',signal?:AbortSignal){const{stdout}=await exec('docker',[...localDockerArgs(),'exec','bogunon-school05-pg','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',user,'-d','school01a','-c',q],{env,signal,timeout:15000,maxBuffer:1048576});return stdout.trim();}
