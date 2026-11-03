export type LocalTask=Readonly<{id:string;title:string;scheduledDate:string;dueDate:string|null;completed:boolean;priority:'low'|'normal'|'high';category:'교육'|'검진'|'행사'|'보고';dday:boolean}>
export type LocalTaskDocument=Readonly<{version:1;revision:number;tasks:readonly LocalTask[]}>
export type LocalTaskLoad=Readonly<{document:LocalTaskDocument;recovered:boolean}>
export const emptyLocalTasks=():LocalTaskDocument=>({version:1,revision:0,tasks:[]})
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
export function validTaskDate(v:unknown):v is string{
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number(v.slice(0,4))<1000)return false
 const d=new Date(`${v}T00:00:00Z`);return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v
}
export function validateLocalTasks(v:unknown):LocalTaskDocument{
 if(!record(v)||Object.keys(v).sort().join(',')!=='revision,tasks,version'||v.version!==1||!Number.isSafeInteger(v.revision)||Number(v.revision)<0||!Array.isArray(v.tasks)||v.tasks.length>2000)throw Error('로컬 업무 데이터 형식과 revision을 확인해 주세요.')
 const seen=new Set<string>()
 const tasks=v.tasks.map((t:unknown):LocalTask=>{
  if(!record(t)||Object.keys(t).sort().join(',')!=='category,completed,dday,dueDate,id,priority,scheduledDate,title'||typeof t.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(t.id)||seen.has(t.id)||typeof t.title!=='string'||!t.title.trim()||t.title.length>120||/[\x00-\x1f\x7f]/.test(t.title)||!validTaskDate(t.scheduledDate)||(t.dueDate!==null&&!validTaskDate(t.dueDate))||typeof t.completed!=='boolean'||typeof t.dday!=='boolean'||!['low','normal','high'].includes(String(t.priority))||!['교육','검진','행사','보고'].includes(String(t.category)))throw Error('업무 제목·날짜·마감일·항목 형식을 확인해 주세요.')
  seen.add(t.id);return {...t} as LocalTask
 })
 const result={version:1 as const,revision:Number(v.revision),tasks}
 if(new TextEncoder().encode(JSON.stringify(result)).length>2*1024*1024)throw Error('로컬 업무 저장 한도를 초과했습니다.')
 return result
}
