import {CalendarDays} from 'lucide-react';
import {commandDefinitions,executeCommand} from '../../../src/commands/commandRegistry';
import type {CommandId,CommandDefinition,CommandExecutionHandlers} from '../../../src/commands/types';
const supported=new Set<CommandId>(['local-calendar','quick-add','home','today-tasks','inbox','calculator','purchase-helper','official-document','toolbox','quick-memo','settings','work-folder','workspace','widget-library','presets','appearance','dock-editor']);
export const electronCommands:readonly CommandDefinition[]=[...commandDefinitions.filter(c=>supported.has(c.id)).map(c=>c.id==='quick-add'?{...c,description:'제목·수행일·마감일을 이 PC의 로컬 업무로 저장합니다.'}:c.id==='quick-memo'?{...c,description:'이 PC에 저장·복원되는 빠른 메모를 엽니다.'}:c.id==='inbox'?{...c,label:'로컬 업무 목록',keywords:['로컬','업무 목록','일정','할 일','inbox'],description:'이 Electron 앱에 저장한 업무를 조회·수정합니다.'}:c.id==='toolbox'?{...c,keywords:['도구','생기부','품의','공문','Finder','교육영상'],description:'공문·품의·생기부·Finder 등 연결된 업무 도구를 엽니다.'}:c.id==='settings'?{...c,description:'화면·위젯·Dock·학교 프로필·AI 연결 설정을 엽니다.'}:c),{id:'local-calendar',kind:'quickAdd',group:'quick',icon:CalendarDays,label:'독립 로컬 일정',description:'업무와 별도로 종일·시간 일정을 이 PC에 저장합니다.',keywords:['일정','달력','캘린더','calendar','event']}];
export const isElectronCommand=(id:unknown):id is CommandId=>typeof id==='string'&&supported.has(id as CommandId);
export async function runElectronCommand(id:unknown,handlers:CommandExecutionHandlers){
 if(!isElectronCommand(id))throw Error('지원하지 않는 Electron 명령입니다.');
 await executeCommand(id as CommandId,handlers);
}
