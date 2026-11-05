import {useMemo} from 'react';
import {useOptionalCalendar} from '../local-calendar/LocalCalendarProvider';
import {withLocalEvents} from '../local-calendar/selectors';
import {useWidgetSession} from '../../../src/dashboard/WidgetSessionContext';
import {formatWorkspaceDate} from '../../../src/workspace-data/workspaceDataAdapter';
import {useLocalWorkspace} from '../local-tasks/LocalWorkspaceProvider'
export {LocalWorkspaceProvider} from '../local-tasks/LocalWorkspaceProvider'
export function useWorkspaceData(){
 const value=useLocalWorkspace(),calendar=useOptionalCalendar(),{now}=useWidgetSession()
 const date=formatWorkspaceDate(now),document=calendar?.document??null;
 const state=useMemo(()=>withLocalEvents(value.state,document,now),[value.state,document,date]);
 return {state,refresh:()=>{void value.refresh();void calendar?.refresh()},setTaskCompleted:value.setTaskCompleted,setTaskActionState:async()=> 'ignored' as const,pendingTaskId:value.pendingTaskId??(value.busy||value.recovered?'local-tasks-unavailable':null),taskMutationError:value.error,taskActionStateError:null}
}
