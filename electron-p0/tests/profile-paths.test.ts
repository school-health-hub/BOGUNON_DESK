import {mkdtemp,realpath,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,win32} from 'node:path';
import {describe,expect,it} from 'vitest';
import {prepareProfilePaths,resolveProfilePaths} from '../main/profile-paths';

const TEST_RUN='4e820293-012e-4301-8305-776875827121';

describe('Electron profile path isolation',()=>{
  it('selects unique F drive appData, userData and sessionData paths for an explicit QA run',()=>{
    const paths=resolveProfilePaths({defaultAppData:'C:\\Users\\synthetic\\AppData\\Roaming',qaRoot:'F:\\BOGUNON_QA\\qa-profile',testRun:TEST_RUN,platform:'win32'});
    expect(paths).toEqual({
      appData:`F:\\BOGUNON_QA\\qa-profile\\test-runs\\${TEST_RUN}\\app-data`,
      userData:`F:\\BOGUNON_QA\\qa-profile\\test-runs\\${TEST_RUN}\\user-data`,
      sessionData:`F:\\BOGUNON_QA\\qa-profile\\test-runs\\${TEST_RUN}\\session-data`,
      qa:true,
    });
  });

  it('preserves the existing operating profile when no QA root is supplied',()=>{
    expect(resolveProfilePaths({defaultAppData:'C:\\Users\\synthetic\\AppData\\Roaming',platform:'win32'})).toEqual({
      appData:'C:\\Users\\synthetic\\AppData\\Roaming',
      userData:'C:\\Users\\synthetic\\AppData\\Roaming\\BOGUNON-DESK-ELECTRON-P0',
      sessionData:'C:\\Users\\synthetic\\AppData\\Roaming\\BOGUNON-DESK-ELECTRON-P0\\chromium',
      qa:false,
    });
  });

  it('preserves the existing isolated test-run path when no F drive QA root is supplied',()=>{
    const paths=resolveProfilePaths({defaultAppData:'C:\\Users\\synthetic\\AppData\\Roaming',testRun:TEST_RUN,platform:'win32'});
    expect(paths.userData).toBe(`C:\\Users\\synthetic\\AppData\\Roaming\\BOGUNON-DESK-ELECTRON-P0\\test-runs\\${TEST_RUN}`);
    expect(paths.qa).toBe(false);
  });

  it.each([
    ['missing test run',undefined,'F:\\BOGUNON_QA\\qa-profile'],
    ['invalid test run','not-a-uuid','F:\\BOGUNON_QA\\qa-profile'],
    ['relative QA root',TEST_RUN,'qa-profile'],
    ['C drive QA root',TEST_RUN,'C:\\BOGUNON_QA\\qa-profile'],
    ['sibling QA root',TEST_RUN,'F:\\BOGUNON_QA-OTHER\\qa-profile'],
  ])('rejects %s',(_label,testRun,qaRoot)=>{
    expect(()=>resolveProfilePaths({defaultAppData:'C:\\Users\\synthetic\\AppData\\Roaming',qaRoot,testRun,platform:'win32'})).toThrow();
  });

  it('creates writable QA directories beneath the canonical approved root',async()=>{
    const root=await mkdtemp(join(tmpdir(),'electron-p0-profile-'));
    try{
      const canonical=await realpath(root);
      const paths=await prepareProfilePaths({approvedQaRoot:canonical,qaRoot:join(canonical,'qa-profile'),testRun:TEST_RUN,pathApi:win32});
      expect(paths.qa).toBe(true);
      expect(paths.appData.startsWith(canonical)).toBe(true);
    }finally{
      await rm(root,{recursive:true,force:true});
    }
  });

  it('uses a different profile for every QA run',()=>{
    const first=resolveProfilePaths({defaultAppData:'C:\\Users\\synthetic\\AppData\\Roaming',qaRoot:'F:\\BOGUNON_QA\\qa-profile',testRun:TEST_RUN,platform:'win32'});
    const second=resolveProfilePaths({defaultAppData:'C:\\Users\\synthetic\\AppData\\Roaming',qaRoot:'F:\\BOGUNON_QA\\qa-profile',testRun:'5f9314a4-1234-4c19-a234-123456789abc',platform:'win32'});
    expect(second.userData).not.toBe(first.userData);
  });

  it('fails closed with a typed code when the QA root cannot be created',async()=>{
    const root=await mkdtemp(join(tmpdir(),'electron-p0-profile-blocked-'));
    const blocked=join(root,'blocked');
    try{
      await writeFile(blocked,'file');
      expect(()=>prepareProfilePaths({approvedQaRoot:root,qaRoot:join(blocked,'qa-profile'),testRun:TEST_RUN,pathApi:win32})).toThrowError(expect.objectContaining({code:'qa_path_unwritable'}));
    }finally{
      await rm(root,{recursive:true,force:true});
    }
  });
});
