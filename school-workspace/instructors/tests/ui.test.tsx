// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';import {render,screen,fireEvent,cleanup,waitFor,within} from '@testing-library/react';
import {InstructorWorkspace} from '../ui/InstructorWorkspace.js';import type {Board,Bridge} from '../core/types.js';
const school='10000000-0000-0000-0000-000000000001',id='00000000-0000-4000-8000-000000000003';
const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(new Date());
function board(role:Board['role']='HEALTH_TEACHER'):Board{return {school,month,role,version:1,name:'합성 강사',instructor:role==='HEALTH_ASSISTANT'?null:{id,name:'합성 강사',subject:'합성',hourlyRate:30000,weeklyHours:14,monthlyInsurance:45000,monthlyHourLimit:60,weeklyHourLimit:15,totalBudget:500000,operationStartDate:month+'-01',operationEndDate:month+'-28'},logs:[],schedule:[{id,date:month+'-01',startTime:'09:00',endTime:'12:00',hours:3}]};}
afterEach(()=>{cleanup();vi.restoreAllMocks();delete (window as any).electronInstructorFiles;});
it('assistant web view shows only month/hours and never calls personal stamp API',async()=>{
 const stampRead=vi.fn();(window as any).electronInstructorFiles={stampRead};const command=vi.fn(async()=>({phase:'ready' as const,board:board('HEALTH_ASSISTANT')}));render(<InstructorWorkspace bridge={{command}} school={school} client="web"/>);
 await screen.findByText('월간 총 근무시간: 3시간');expect(screen.queryByLabelText('강사 관리 메뉴')).toBeNull();expect(screen.queryByText('개인 도장 등록')).toBeNull();expect(screen.queryByText('Excel 근무자료 가져오기')).toBeNull();expect(stampRead).not.toHaveBeenCalled();expect(screen.getByText('조회만 가능합니다.',{exact:false})).toBeTruthy();
});
it('teacher reuses work/settings panes; duplicate submit blocked and failed write keeps input',async()=>{
 const b=board(),command=vi.fn<Bridge['command']>(async action=>action==='read'?{phase:'ready',board:b}:{phase:'error',message:'합성 저장 실패'});render(<InstructorWorkspace bridge={{command}} school={school} client="electron"/>);
 await screen.findByRole('navigation',{name:'강사 관리 메뉴'});fireEvent.click(screen.getByRole('button',{name:/^근무기록$/}));const form=screen.getByRole('form',{name:'근무표 편집'});fireEvent.change(within(form).getByLabelText('시작 시간'),{target:{value:'09:00:00'}});fireEvent.change(within(form).getByLabelText('종료 시간'),{target:{value:'12:00:00'}});fireEvent.change(within(form).getByLabelText('교사 비고'),{target:{value:'합성 자료'}});fireEvent.submit(form);fireEvent.submit(form);
 await screen.findByText('합성 저장 실패');expect(command.mock.calls.filter(c=>c[0]==='save')).toHaveLength(1);expect((within(form).getByLabelText('교사 비고') as HTMLTextAreaElement).value).toBe('합성 자료');
});
it('print defaults unstamped on every open, cancel creates no output; no invented payment seal location',async()=>{
 const b=board();b.logs=[{id,instructorId:id,date:month+'-01',startTime:'09:00',endTime:'12:00',note:null}];const print=vi.fn();(window as any).electronInstructorFiles={stampRead:async()=>({ok:true,status:'ready',data:{dataUrl:'data:image/png;base64,synthetic',width:32,height:48}}),print};render(<InstructorWorkspace bridge={{command:async()=>({phase:'ready',board:b})}} school={school} client="electron"/>);
 await screen.findByRole('navigation',{name:'강사 관리 메뉴'});fireEvent.click(screen.getByRole('button',{name:'지급명세서·출력'}));fireEvent.click(screen.getByRole('button',{name:'출근관리부 미리보기'}));const check=await screen.findByLabelText('이번 출력에 개인 도장 포함');await waitFor(()=>expect((check as HTMLInputElement).disabled).toBe(false));expect((check as HTMLInputElement).checked).toBe(false);
 const before=screen.getByRole('dialog',{name:'출력 미리보기'}).textContent;fireEvent.click(check);expect(screen.getAllByAltText('보건교사 개인 도장')).toHaveLength(1);expect(screen.getByRole('dialog',{name:'출력 미리보기'}).textContent).toBe(before);fireEvent.click(screen.getByRole('button',{name:'출력 취소·닫기'}));expect(print).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'출근관리부 미리보기'}));expect((await screen.findByLabelText('이번 출력에 개인 도장 포함') as HTMLInputElement).checked).toBe(false);fireEvent.click(screen.getByRole('button',{name:'출력 취소·닫기'}));fireEvent.click(screen.getByRole('button',{name:'지급명세서 미리보기'}));expect((await screen.findByLabelText('이번 출력에 개인 도장 포함') as HTMLInputElement).disabled).toBe(true);expect(screen.getByText(/임의 위치에 도장을 삽입하지/)).toBeTruthy();
});
it('late account/school read is ignored after unmount',async()=>{
 let resolve!:(v:any)=>void;const command=vi.fn(()=>new Promise<any>(r=>resolve=r));const v=render(<InstructorWorkspace bridge={{command}} school={school} client="electron"/>);v.unmount();resolve({phase:'ready',board:board()});await Promise.resolve();expect(screen.queryByText('합성 강사')).toBeNull();
});
