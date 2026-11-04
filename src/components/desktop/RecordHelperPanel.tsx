import {useChatGptConnection} from '../../chatgpt/ChatGptConnectionContext';
import {importRecordHelperReports} from '../../record-helper/reportImportService';
import {RecordHelperWorkspacePanel,type RecordHelperWorkspacePanelProps} from './RecordHelperWorkspacePanel';
type Props=Omit<RecordHelperWorkspacePanelProps,'chatGpt'|'importReports'>&{readonly importReports?:RecordHelperWorkspacePanelProps['importReports']};
// Keep the Tauri entry/API; the actual panel, reducer and review UI are shared with Electron.
export function RecordHelperPanel({importReports=importRecordHelperReports,...props}:Props){
 const chatGpt=useChatGptConnection();return <RecordHelperWorkspacePanel {...props} importReports={importReports} chatGpt={chatGpt}/>;
}
