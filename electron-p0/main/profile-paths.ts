import {closeSync,mkdirSync,openSync,realpathSync,unlinkSync,writeFileSync} from 'node:fs';
import {win32} from 'node:path';
import {PROFILE_NAME} from '../protocol.js';

const TEST_RUN_PATTERN=/^[a-f0-9-]{36}$/;
const APPROVED_QA_ROOT='F:\\BOGUNON_QA';

type PathApi=Pick<typeof win32,'isAbsolute'|'join'|'relative'|'resolve'|'sep'>;

export type ProfilePaths=Readonly<{
  appData:string;
  userData:string;
  sessionData:string;
  qa:boolean;
}>;

type ResolveProfilePathInput=Readonly<{
  defaultAppData:string;
  platform:NodeJS.Platform;
  qaRoot?:string;
  testRun?:string;
}>;

type PrepareProfilePathInput=Readonly<{
  approvedQaRoot:string;
  qaRoot:string;
  testRun:string;
  pathApi:PathApi;
}>;

export class ProfilePathError extends Error{
  readonly code:string;
  constructor(code:string){super(code);this.name='ProfilePathError';this.code=code;}
}

const isWithin=(parent:string,candidate:string,pathApi:PathApi):boolean=>{
  const relative=pathApi.relative(pathApi.resolve(parent),pathApi.resolve(candidate));
  return relative===''||(!relative.startsWith(`..${pathApi.sep}`)&&relative!=='..'&&!pathApi.isAbsolute(relative));
};

const qaPaths=(qaRoot:string,testRun:string,pathApi:PathApi):ProfilePaths=>{
  const runRoot=pathApi.join(qaRoot,'test-runs',testRun);
  return {appData:pathApi.join(runRoot,'app-data'),userData:pathApi.join(runRoot,'user-data'),sessionData:pathApi.join(runRoot,'session-data'),qa:true};
};

export const resolveProfilePaths=(input:ResolveProfilePathInput):ProfilePaths=>{
  if(input.qaRoot!==undefined){
    if(input.platform!=='win32'||input.testRun===undefined||!TEST_RUN_PATTERN.test(input.testRun))throw new ProfilePathError('invalid_qa_identity');
    if(!win32.isAbsolute(input.qaRoot)||!isWithin(APPROVED_QA_ROOT,input.qaRoot,win32))throw new ProfilePathError('qa_root_not_approved');
    return qaPaths(win32.resolve(input.qaRoot),input.testRun,win32);
  }
  if(input.testRun!==undefined&&!TEST_RUN_PATTERN.test(input.testRun))throw new ProfilePathError('invalid_test_run');
  const userData=input.testRun===undefined
    ?win32.join(input.defaultAppData,PROFILE_NAME)
    :win32.join(input.defaultAppData,PROFILE_NAME,'test-runs',input.testRun);
  return {appData:input.defaultAppData,userData,sessionData:win32.join(userData,'chromium'),qa:false};
};

export const prepareProfilePaths=(input:PrepareProfilePathInput):ProfilePaths=>{
  if(!TEST_RUN_PATTERN.test(input.testRun))throw new ProfilePathError('invalid_test_run');
  if(!input.pathApi.isAbsolute(input.approvedQaRoot)||!input.pathApi.isAbsolute(input.qaRoot)||!isWithin(input.approvedQaRoot,input.qaRoot,input.pathApi))throw new ProfilePathError('qa_root_not_approved');
  try{
    mkdirSync(input.approvedQaRoot,{recursive:true});
    mkdirSync(input.qaRoot,{recursive:true});
    const approved=realpathSync(input.approvedQaRoot);
    const qaRoot=realpathSync(input.qaRoot);
    if(!isWithin(approved,qaRoot,input.pathApi))throw new ProfilePathError('qa_root_not_approved');
    const paths=qaPaths(qaRoot,input.testRun,input.pathApi);
    for(const directory of [paths.appData,paths.userData,paths.sessionData]){
      mkdirSync(directory,{recursive:true});
      const probe=input.pathApi.join(directory,'.write-probe');
      const descriptor=openSync(probe,'wx');
      try{writeFileSync(descriptor,'qa');}finally{closeSync(descriptor);unlinkSync(probe);}
    }
    return paths;
  }catch(error){
    if(error instanceof ProfilePathError)throw error;
    throw new ProfilePathError('qa_path_unwritable');
  }
};

export const approvedQaRoot=():string=>APPROVED_QA_ROOT;
