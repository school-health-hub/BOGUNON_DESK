import {createRoot} from 'react-dom/client';
import {WorkspacePanel} from './WorkspacePanel.js';
import {createPreview} from './preview.js';
const params=new URLSearchParams(location.search),client=location.pathname.includes('desktop')?'electron':'web';
createRoot(document.getElementById('root')!).render(<WorkspacePanel controller={createPreview(params.get('scenario')??'active')} client={client}/>);
