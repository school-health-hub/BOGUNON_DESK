import {it,expect} from 'vitest';import {InstructorController} from '../core/controller.js';import type {SchoolState} from '../../school02/core/types.js';
const school='10000000-0000-0000-0000-000000000001',scope={selected:school,workspace:{phase:'approved',context:{role:'HEALTH_TEACHER'}}} as SchoolState;
const board={school,month:'2026-08',role:'HEALTH_TEACHER',version:0,name:'',instructor:null,logs:[],schedule:[]};
it('school/account invalidation aborts late work and permits fresh session read without old lock',async()=>{
 let finish!:(v:unknown)=>void;let n=0;const c=new InstructorController({school:async()=>scope,call:async()=>++n===1?new Promise(r=>finish=r):board});
 const old=c.command('settings',{school,month:'2026-08',version:0,request_id:crypto.randomUUID(),payload:{name:'합성',subject:'운영',weeklyHours:14,hourlyRate:30000,monthlyInsurance:45000,weeklyHourLimit:15,monthlyHourLimit:60,totalBudget:500000,operationStartDate:'2026-08-01',operationEndDate:'2026-12-31'}});await Promise.resolve();c.invalidate();const next=await c.command('read',{school,month:'2026-08'});expect(next.phase).toBe('ready');finish(board);expect((await old).board).toBeUndefined();
});
it('expired session clears access; forged read-only response with private data is rejected',async()=>{
 const denied=new InstructorController({school:async()=>({...scope,workspace:{phase:'expired_session'}} as SchoolState),call:async()=>{throw Error('must not call');}});expect((await denied.command('read',{school,month:'2026-08'})).phase).toBe('locked');
 const viewer=new InstructorController({school:async()=>({...scope,workspace:{phase:'approved',context:{role:'HEALTH_ASSISTANT'}}} as SchoolState),call:async()=>({...board,role:'HEALTH_ASSISTANT',privateStamp:'forbidden'})});expect((await viewer.command('read',{school,month:'2026-08'})).phase).toBe('error');
});
