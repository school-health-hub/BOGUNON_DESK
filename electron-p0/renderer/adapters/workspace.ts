import {useLocalWorkspace} from '../local-tasks/LocalWorkspaceProvider'
export {LocalWorkspaceProvider} from '../local-tasks/LocalWorkspaceProvider'
export function useWorkspaceData(){
 const value=useLocalWorkspace()
 return {state:value.state,refresh:()=>{void value.refresh()},setTaskCompleted:value.setTaskCompleted,setTaskActionState:async()=> 'ignored' as const,pendingTaskId:value.pendingTaskId??(value.busy||value.recovered?'local-tasks-unavailable':null),taskMutationError:value.error,taskActionStateError:null}
}
