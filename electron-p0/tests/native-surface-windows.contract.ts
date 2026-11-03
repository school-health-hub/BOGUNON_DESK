import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {approveHost,HOST_FILE} from '../main/desktop-surface/native02/approved-host.js';
import {NativeHostLauncher} from '../main/desktop-surface/native02/launcher.js';
import {WindowsInspector} from '../main/desktop-surface/native02/windows-inspector.js';
import {spawnHost} from '../main/desktop-surface/native02/process-port.js';
import {FrameChannel} from '../main/desktop-surface/native02/framing.js';
import {deadline} from '../main/desktop-surface/native02/errors.js';

const enabled=process.platform==='win32'&&process.env['NATIVE02_WINDOWS_QA']==='1';
const sourceSha='ccc2e7aebf9ee6ce1177cd8956f7b8b84ea89d9b';
async function approval(){
  const sha256=createHash('sha256').update(await readFile(resolve('artifacts/native-02/bin',HOST_FILE))).digest('hex');
  return approveHost({mode:'development',root:resolve('.'),sha256,sourceSha});
}
test('Windows: actual approved headless process, authenticated private IPC, EOF exit and residual check',
  {skip:!enabled,timeout:45000},async()=>{
    const launcher=new NativeHostLauncher(await approval(),new WindowsInspector());
    try{
      assert.equal((await launcher.start()).state,'Authenticated');
      assert.equal((await launcher.checkHealth()).nativeAttachmentVerified,false);
    }catch(error){
      await launcher.stop();throw error;
    }
    {
      const result=await launcher.stop();
      assert.equal(result.processExitVerified,true);
      assert.equal(result.forcedTermination,false);
      assert.equal(result.nativeCleanup,'NotVerified');
      assert.equal(result.state,'CleanupUnknown');
    }
    await assert.rejects(launcher.start(),{code:'CleanupUnknown'});
  });
test('Windows: actual Host rejects foreign process grant before any Native operation',
  {skip:!enabled,timeout:15000},async()=>{
    const host=await approval(),child=await spawnHost(host.imagePath);
    const channel=new FrameChannel(child.output,child.input,()=>{});
    const capability=randomBytes(32);
    const grant=Buffer.from(JSON.stringify({generation:1,attempt:2,expected_surface_pid:child.pid+1,capability:[...capability]}));
    try{
      await channel.write(grant,2000);child.input.end();
      const exit=await deadline(child.exited,5000);assert.equal(exit.code,2);
      assert.equal(await new WindowsInspector().process(child.pid),null);
    }finally{grant.fill(0);capability.fill(0);channel.close();}
  });
