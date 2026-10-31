import type { WorkspaceDataState } from '../../../src/workspace-data/types';
export function useWorkspaceData() {
  const state: WorkspaceDataState = {status:'ready',data:{todayTasks:[],calendarEvents:[],weekSchedule:[],upcomingEvents:[],ddayItems:[],notifications:[],inboxItems:[],summary:{todayEventCount:0,todayTaskCount:0,incompleteTaskCount:0}}};
  return {state,refresh:()=>{},setTaskCompleted:async()=> 'ignored' as const,setTaskActionState:async()=> 'ignored' as const,pendingTaskId:null,taskMutationError:null,taskActionStateError:null};
}
