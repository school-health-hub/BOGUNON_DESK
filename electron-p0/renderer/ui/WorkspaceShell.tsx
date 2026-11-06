import type {ReactNode} from 'react';
import {ArrowLeft} from 'lucide-react';

/** Presentation only: the owning workspace keeps its state, navigation and cleanup. */
export function WorkspaceShell({name,children,overlay=false}:{name:string;children:ReactNode;overlay?:boolean}){
 return <div className={`td2-workspace${overlay?' td2-workspace-overlay':''}`} data-workspace={name}>{children}</div>;
}

export function WorkspaceHeader({title,description,context,onBack,backDisabled=false,actions}:{title:string;description?:string;context?:string;onBack:()=>void;backDisabled?:boolean;actions?:ReactNode}){
 return <header className="td2-workspace-header">
  <div className="td2-heading"><button type="button" className="td2-back" disabled={backDisabled} onClick={onBack}><ArrowLeft size={16} aria-hidden="true"/>보건 업무로</button>{context&&<span className="td2-context">{context}</span>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>
  {actions&&<div className="td2-header-actions">{actions}</div>}
 </header>;
}
