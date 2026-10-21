import { createContext, useContext, type ReactNode } from "react";
import type { WorkspaceDataState } from "./types";

type WorkspaceDataNoticeProps = {
  readonly state: Exclude<WorkspaceDataState, { readonly status: "ready" }>;
};

const noticeText: Readonly<Record<WorkspaceDataNoticeProps["state"]["status"], string>> = {
  loading: "BOGUNON 데이터를 불러오는 중입니다.",
  signedOut: "설정에서 Google 계정을 연결하면 BOGUNON 데이터를 볼 수 있습니다.",
  error: "데이터를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.",
};

const CompactNoticeContext = createContext(false);
export function CompactWorkspaceNotices({ children }: { readonly children: ReactNode }) {
  return <CompactNoticeContext.Provider value={true}>{children}</CompactNoticeContext.Provider>;
}

export function WorkspaceDataNotice({ state }: WorkspaceDataNoticeProps) {
  const compact = useContext(CompactNoticeContext);
  if (compact && state.status === "signedOut") return <p className="workspace-connection-placeholder"><span aria-hidden="true">—</span><span className="sr-only">계정 연결 대기</span></p>;
  return <div className={`workspace-data-notice is-${state.status}`} role="status">{noticeText[state.status]}</div>;
}

export function WorkspaceDataEmpty({ children }: { readonly children: string }) {
  return <div className="workspace-data-notice is-empty">{children}</div>;
}

/** Presentation only: a desktop-level banner owns repeated connection instructions. */
export function WorkspaceConnectionNotice({ children }: { readonly children: ReactNode }) {
  const compact = useContext(CompactNoticeContext);
  return compact ? <p className="workspace-connection-placeholder"><span aria-hidden="true">—</span><span className="sr-only">연결 설정 대기</span></p> : children;
}
