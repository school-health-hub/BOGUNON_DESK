import {createContext,useContext,useId,useLayoutEffect,type ReactNode} from 'react';

export const WorkspaceLoadingContext=createContext<Set<string>|null>(null);
export function WorkspaceLoadingReporter({children}:{readonly children:ReactNode}){
  const registry=useContext(WorkspaceLoadingContext),id=useId();
  useLayoutEffect(()=>{
    registry?.add(id);
    return()=>{registry?.delete(id);};
  },[id,registry]);
  return <>{children}</>;
}
