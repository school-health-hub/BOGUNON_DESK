import {extractOfficialDocumentSummary} from '../../../src/official-document/summaryExtractor';
import {createOfficialDocumentQuickAddDraft} from '../../../src/official-document/summaryToQuickAddDraft';
import {localQuickTask} from '../desktop-utilities/localQuickAdd';
import type {LocalTask} from '../../local-tasks';
export type SummaryTaskCandidate={id:string;selected:boolean;title:string;date:string;due:string;category:LocalTask['category'];priority:LocalTask['priority']};
export function summaryTaskCandidates(text:string,date:string,ids:readonly string[]):SummaryTaskCandidate[]{
 const summary=extractOfficialDocumentSummary(text),actions=summary.actions.length?summary.actions:[{value:null,evidence:null}];
 return actions.slice(0,10).map((action,index)=>{
  const draft=createOfficialDocumentQuickAddDraft({...summary,actions:[action]});
  return {id:ids[index]!,selected:false,title:action.value===null?'':draft.title,date,due:draft.dueDate??'',category:'보고',priority:'normal'};
 });
}
export function reviewedSummaryTask(row:SummaryTaskCandidate):LocalTask{
 const categories={교육:'training',검진:'studentHealthScreening',행사:'event',보고:'officialDocument'} as const;
 return localQuickTask({kind:'task',title:row.title,date:row.date,dueDate:row.due,area:'healthWork',category:categories[row.category],priority:row.priority},row.id);
}
export function sameSummaryTask(a:LocalTask,b:LocalTask){return (Object.keys(b) as (keyof LocalTask)[]).every(key=>a[key]===b[key]);}
