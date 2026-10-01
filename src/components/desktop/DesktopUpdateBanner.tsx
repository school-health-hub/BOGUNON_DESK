import { Download, RefreshCw } from "lucide-react";
import type { DesktopUpdaterState } from "../../updater/updaterTypes";

type DesktopUpdateBannerProps = {
  readonly state: DesktopUpdaterState;
  readonly onDismiss: () => void;
  readonly onRetry: () => void;
  readonly onUpdate: () => void;
};

const progressLabel = (state: Extract<DesktopUpdaterState, { readonly status: "downloading" }>): string => {
  if (state.progress.totalBytes === null || state.progress.totalBytes <= 0) return "업데이트 다운로드 중...";
  const percentage = Math.min(100, Math.floor(
    (state.progress.downloadedBytes / state.progress.totalBytes) * 100,
  ));
  return `업데이트 다운로드 중 ${percentage}%`;
};

export function DesktopUpdateBanner(props: DesktopUpdateBannerProps) {
  if (props.state.status === "available") {
    return (
      <section className="desktop-update-banner" aria-label="앱 업데이트">
        <Download size={17} />
        <div>
          <strong>BOGUNON DESK {props.state.metadata.version} 업데이트가 있습니다.</strong>
          <span>현재 버전 {props.state.metadata.currentVersion}</span>
          {props.state.metadata.notes !== null && <small>{props.state.metadata.notes}</small>}
        </div>
        <div className="desktop-update-banner__actions">
          <button type="button" onClick={props.onUpdate}>업데이트</button>
          <button className="is-secondary" type="button" onClick={props.onDismiss}>나중에</button>
        </div>
      </section>
    );
  }
  if (props.state.status === "downloading" || props.state.status === "installing") {
    const label = props.state.status === "downloading"
      ? progressLabel(props.state)
      : "업데이트 설치를 위해 앱이 종료됩니다.";
    return (
      <section className="desktop-update-banner is-progress" aria-live="polite">
        <RefreshCw className="is-spinning" size={17} />
        <div><strong>{label}</strong><span>작업이 끝날 때까지 앱을 종료하지 마세요.</span></div>
      </section>
    );
  }
  if (props.state.status === "error" && props.state.operation === "install") {
    return (
      <section className="desktop-update-banner is-error" role="alert">
        <div><strong>{props.state.message}</strong><span>현재 앱은 계속 사용할 수 있습니다.</span></div>
        <button type="button" onClick={props.onRetry}>다시 시도</button>
      </section>
    );
  }
  return null;
}
