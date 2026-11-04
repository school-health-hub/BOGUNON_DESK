import type {OfficialDocumentDraft,OfficialDocumentInput} from './types';
/** Session-only adapter. No paths, credentials, or new persistence contract. */
export type OfficialWorkflowContext={
 readonly version:string;
 readonly sessionId:number;
 readonly source:string;
 readonly draft:OfficialDocumentDraft|null;
 readonly input:OfficialDocumentInput;
 readonly busy:boolean;
 readonly apply:(version:string,title:string,body:string,append:boolean)=>boolean;
 readonly onBusyChange:(busy:boolean)=>void;
 readonly onDirtyChange:(dirty:boolean)=>void;
};
