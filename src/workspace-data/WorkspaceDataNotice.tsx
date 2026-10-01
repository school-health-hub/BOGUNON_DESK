import type { WorkspaceDataState } from "./types";

type WorkspaceDataNoticeProps = {
  readonly state: Exclude<WorkspaceDataState, { readonly status: "ready" }>;
};

const noticeText: Readonly<Record<WorkspaceDataNoticeProps["state"]["status"], string>> = {
  loading: "BOGUNON 데이터를 불러오는 중입니다.",
  signedOut: "설정에서 Google 계정을 연결하면 BOGUNON 데이터를 볼 수 있습니다.",
  error: "데이터를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.",
};

export function WorkspaceDataNotice({ state }: WorkspaceDataNoticeProps) {
  return <div className={`workspace-data-notice is-${state.status}`} role="status">{noticeText[state.status]}</div>;
}

export function WorkspaceDataEmpty({ children }: { readonly children: string }) {
  return <div className="workspace-data-notice is-empty">{children}</div>;
}
