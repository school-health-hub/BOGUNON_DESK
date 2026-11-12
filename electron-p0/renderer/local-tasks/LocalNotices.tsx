import type {ReactNode} from 'react'
import type {WorkspaceDataState} from '../../../src/workspace-data/types'
import {useLocalWorkspace} from './LocalWorkspaceProvider'
export function CompactWorkspaceNotices({children}:{children:ReactNode}){return <>{children}</>}
type NoticeState=Exclude<WorkspaceDataState,{status:'ready'}>
// The Vite replacement is shared by task, weather and meal widgets. Their
// disconnected state is not a local task storage failure; ready renders data.
const noticeText:Readonly<Record<NoticeState['status'],string>>={
 loading:'로컬 업무를 불러오는 중입니다.',
 signedOut:'날씨·급식이 연결되어 있지 않습니다.',
 error:'로컬 업무를 불러오지 못했습니다. 업무 도구에서 다시 불러와 주세요. 기존 파일은 유지됩니다.',
}
export function WorkspaceDataNotice({state}:{state:NoticeState}){return <div className={`workspace-data-notice is-${state.status}`} role="status">{noticeText[state.status]}</div>}
export function WorkspaceDataEmpty({children}:{children:string}){return <div className="workspace-data-notice is-empty">{children}</div>}
export function LocalWorkspaceStatus({onOpen}:{onOpen:()=>void}){const {error,recovered}=useLocalWorkspace();return error||recovered?<div className="p0-notice" role="alert">{error??'로컬 업무 백업을 읽었습니다. 원본 보존을 위해 읽기 전용입니다.'}<button type="button" onClick={onOpen}>로컬 업무 확인</button></div>:null}
