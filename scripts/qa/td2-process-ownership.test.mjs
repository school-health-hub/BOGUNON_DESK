import {test} from 'node:test';import assert from 'node:assert/strict';import {ownedProcessIdentities} from './process-ownership.mjs';
const row=(id,parent,seconds)=>({ProcessId:id,ParentProcessId:parent,CreationDate:new Date(seconds*1000).toISOString()});
test('tracks real descendants with matching chronological parent identities',()=>assert.deepEqual(ownedProcessIdentities([row(1,0,10),row(2,1,11),row(3,2,12)],1).map(r=>r.ProcessId),[1,2,3]));
test('never adopts old unrelated processes when their previous parent PID is reused',()=>assert.deepEqual(ownedProcessIdentities([row(100,0,100),row(2,100,20),row(3,2,21),row(4,100,101)],100).map(r=>r.ProcessId),[100,4]));
test('missing root and invalid creation timestamps cannot establish ownership',()=>{assert.deepEqual(ownedProcessIdentities([row(2,1,20)],1),[]);assert.deepEqual(ownedProcessIdentities([{ProcessId:1,CreationDate:'unknown'}],1),[]);});
