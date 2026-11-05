import{ProductWorkspace}from'../../school-workspace/school05/ui/ProductWorkspace';import type{WorkspaceProductApi}from'../workspace-protocol';
export default function WorkspaceProductHost({onClose}:{onClose:()=>void}){return <ProductWorkspace api={(window as Window&{electronWorkspace?:WorkspaceProductApi}).electronWorkspace} onClose={onClose}/>;}
