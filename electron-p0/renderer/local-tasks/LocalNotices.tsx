import type {ReactNode} from 'react'
import type {WorkspaceDataState} from '../../../src/workspace-data/types'
import {useLocalWorkspace} from './LocalWorkspaceProvider'
export function CompactWorkspaceNotices({children}:{children:ReactNode}){return <>{children}</>}
export function WorkspaceDataNotice({state}:{state:Exclude<WorkspaceDataState,{status:'ready'}>}){
 const messages={loading:'로컬 업무를 불러오는 중입니다.',signedOut:'연결 전 상태입니다. 로컬 업무 데이터와는 별개입니다.',error:'로컬 업무를 불러오지 못했습니다. 업무 도구에서 다시 불러와 주세요. 기존 파일은 유지됩니다.'} as const
 return <div className={`workspace-data-notice is-${state.status}`} role="status">{messages[state.status]}</div>
}
export function WorkspaceDataEmpty({children}:{children:string}){return <div className="workspace-data-notice is-empty">{children}</div>}
export function LocalWorkspaceStatus({onOpen}:{onOpen:()=>void}){const {error,recovered}=useLocalWorkspace();return error||recovered?<div className="p0-notice" role="alert">{error??'로컬 업무 백업을 읽었습니다. 원본 보존을 위해 읽기 전용입니다.'}<button type="button" onClick={onOpen}>로컬 업무 확인</button></div>:null}
