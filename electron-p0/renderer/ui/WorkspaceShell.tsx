import type {ReactNode} from 'react';

export {WorkspaceHeader} from '../../../src/components/workspace/WorkspaceHeader';

/** Presentation only: the owning workspace keeps its state, navigation and cleanup. */
export function WorkspaceShell({name,children,overlay=false}:{name:string;children:ReactNode;overlay?:boolean}){
 return <div className={`td2-workspace${overlay?' td2-workspace-overlay':''}`} data-workspace={name}>{children}</div>;
}

/** Native disclosure keeps the editor mounted, including unsaved review state. */
export function WorkspaceDisclosure({title,children}:{title:string;children:ReactNode}){
 return <details className="td2-workspace-disclosure"><summary>{title}</summary>{children}</details>;
}
