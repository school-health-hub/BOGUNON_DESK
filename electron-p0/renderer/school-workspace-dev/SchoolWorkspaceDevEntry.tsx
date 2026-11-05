import {useState} from 'react';
import {WorkspacePanel} from '../../../school-workspace/integration/dev-ui/WorkspacePanel';
import {createPreview} from '../../../school-workspace/integration/dev-ui/preview';
/** Imported only behind DEV + ELECTRON_P0_PUBLIC_SCHOOL01C_DEV. No real accounts or network. */
export default function SchoolWorkspaceDevEntry(){
 const[open,setOpen]=useState(false),[controller]=useState(()=>createPreview());
 return <aside><button type="button" onClick={()=>setOpen(v=>!v)}>우리 보건실 · 개발용</button>{open&&<WorkspacePanel controller={controller} client="electron"/>}</aside>;
}
