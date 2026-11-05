export const SEOUL='Asia/Seoul';
export const seoulDate=(value:string|number=Date.now())=>new Intl.DateTimeFormat('en-CA',{timeZone:SEOUL,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export const displayTime=(value:string,allDay=false)=>new Intl.DateTimeFormat('ko-KR',{timeZone:SEOUL,year:'numeric',month:'2-digit',day:'2-digit',...(!allDay?{hour:'2-digit',minute:'2-digit',hour12:false}:{})}).format(new Date(value));
export const localInput=(value:string)=>{const f=new Intl.DateTimeFormat('sv-SE',{timeZone:SEOUL,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});return f.format(new Date(value)).replace(' ','T');};
export const dayAfter=(date:string)=>new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);
export const toInstant=(value:string,allDay=false,inclusiveEnd=false)=>new Date((allDay?(inclusiveEnd?dayAfter(value):value)+'T00:00:00':value)+(!allDay&&value.length===16?':00':'')+'+09:00').toISOString();
export function range(month:string){if(!/^\d{4}-\d{2}$/.test(month)||Number(month.slice(5))<1||Number(month.slice(5))>12)throw Error('input');const y=Number(month.slice(0,4)),m=Number(month.slice(5));const end=new Date(Date.UTC(y,m+1,1)).toISOString().slice(0,10);return{from:toInstant(month+'-01',true),to:toInstant(end,true)};}
