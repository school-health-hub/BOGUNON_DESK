import {it,expect} from 'vitest';
import {join,resolve} from 'node:path';
import {qaProfilePaths} from '../main/qa-profile.js';
const base={tempRoot:resolve('/tmp/qa'),defaultAppData:resolve('/users/synthetic/appdata'),profileName:'desk'};
const id='12345678-1234-1234-1234-123456789abc';
it('preserves normal and legacy profile paths',()=>{
 expect(qaProfilePaths(base).userData).toBe(join(base.defaultAppData,'desk'));
 expect(qaProfilePaths({...base,runId:id}).userData).toBe(join(base.defaultAppData,'desk','test-runs',id));
});
it('isolates app, session and user storage with explicit UUID opt-in',()=>{
 const root=join(base.tempRoot,'owned');const p=qaProfilePaths({...base,enabled:'1',root,runId:id});
 expect(p.userData).toBe(join(root,'test-runs',id,'user-data'));expect(p.sessionData).toBe(join(p.userData,'chromium'));expect(p.appData).toBe(join(root,'app-data'));
});
it('rejects implicit, relative, root, outside and overlapping profile paths',()=>{
 for(const extra of [{root:join(base.tempRoot,'x'),runId:id},{enabled:'1',root:'relative',runId:id},{enabled:'1',root:base.tempRoot,runId:id},{enabled:'1',root:resolve('/outside'),runId:id},{enabled:'1',root:join(base.tempRoot,'x'),runId:'invalid'}])expect(()=>qaProfilePaths({...base,...extra})).toThrow();
 expect(()=>qaProfilePaths({...base,tempRoot:resolve('/users'),enabled:'1',root:join(base.defaultAppData,'desk','qa'),runId:id})).toThrow();
});
