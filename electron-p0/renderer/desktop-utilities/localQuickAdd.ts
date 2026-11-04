import {validateQuickAddTask,type QuickAddInput} from '../../../src/workspace-data/workItemCreateService';
import {validateLocalTasks,type LocalTask} from '../../local-tasks';
const categories={training:'교육',studentHealthScreening:'검진',event:'행사',officialDocument:'보고'} as const;
export function localQuickTask(input:QuickAddInput,id:string):LocalTask{
 if(input.kind!=='task'||input.area!=='healthWork'||!Object.prototype.hasOwnProperty.call(categories,input.category))throw Error('로컬 업무에서 지원하는 분류·입력만 저장할 수 있습니다. 독립 일정과 서버 동기화는 지원하지 않습니다.');
 const value=validateQuickAddTask(input),task:LocalTask={id,title:value.title,scheduledDate:value.scheduledDate,dueDate:value.dueDate,priority:value.priority,category:categories[input.category as keyof typeof categories],completed:false,dday:true};
 return validateLocalTasks({version:1,revision:0,tasks:[task]}).tasks[0];
}
