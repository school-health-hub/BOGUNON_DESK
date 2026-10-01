import { ArrowRight, Bot, BriefcaseBusiness, Folder, HeartPulse, Monitor, Wrench } from "lucide-react";
import { Panel } from "../components/Panel";
import { useDesktopPanels } from "../components/desktop/DesktopPanelContext";
import type { DesktopActionId } from "../desktop/types";
import type { WorkFolderFavorite } from "../work-folders/types";

type QuickLauncherAction = {
  readonly actionId: DesktopActionId;
  readonly label: string;
  readonly deviceOnly?: boolean;
  readonly icon: typeof HeartPulse;
};

export const QUICK_LAUNCHER_ACTIONS: readonly QuickLauncherAction[] = [
  { actionId: "online-health-room", label: "온라인 보건실", icon: HeartPulse },
  { actionId: "bogunon", label: "BOGUNON", icon: Bot },
  { actionId: "work-portal", label: "업무포털", icon: BriefcaseBusiness, deviceOnly: true },
  { actionId: "toolbox", label: "업무 도구", icon: Wrench },
] as const;

export const selectQuickLauncherFolders = (
  favorites: readonly WorkFolderFavorite[],
): readonly WorkFolderFavorite[] => favorites.slice(0, 4);

export function QuickLauncherWidget() {
  const { runDesktopAction, workFolderFavorites, openWorkFolderFavorite } = useDesktopPanels();
  const folders = selectQuickLauncherFolders(workFolderFavorites);

  return (
    <Panel
      title="빠른 실행"
      icon={Monitor}
      className="quick-launcher"
      action={workFolderFavorites.length > 0 ? (
        <button className="quick-launcher__all" type="button" onClick={() => void runDesktopAction("work-folder")}>
          모두 보기 <ArrowRight size={12} />
        </button>
      ) : undefined}
    >
      <div className="quick-launcher__actions" aria-label="빠른 실행 기능">
        {QUICK_LAUNCHER_ACTIONS.map(({ actionId, deviceOnly, icon: Icon, label }) => (
          <button key={actionId} type="button" aria-label={label} onClick={() => void runDesktopAction(actionId)}>
            <span className="quick-launcher__tile-icon" aria-hidden="true"><Icon size={17} /></span>
            <span>{label}</span>
            {deviceOnly && <small><Monitor size={10} aria-hidden="true" /> 이 기기</small>}
          </button>
        ))}
      </div>

      <section className="quick-launcher__folders" aria-label="이 기기의 업무 폴더">
        <header><Folder size={13} aria-hidden="true" /><strong>업무 폴더</strong><small><Monitor size={10} aria-hidden="true" /> 이 기기</small></header>
        {folders.length === 0 ? (
          <button className="quick-launcher__empty" type="button" onClick={() => void runDesktopAction("work-folder")}>
            등록된 폴더가 없습니다. 폴더 열기
          </button>
        ) : (
          <ul>
            {folders.map((favorite) => (
              <li key={favorite.id}>
                <button
                  type="button"
                  disabled={!favorite.available}
                  aria-label={favorite.available ? `${favorite.name} 폴더 열기` : `${favorite.name} 폴더를 사용할 수 없음`}
                  title={favorite.available ? favorite.displayPath : `${favorite.displayPath} · 사용할 수 없음`}
                  onClick={favorite.available ? () => void openWorkFolderFavorite(favorite) : undefined}
                >
                  <Folder size={13} aria-hidden="true" />
                  <span>{favorite.name}</span>
                  {!favorite.available && <small>연결 안 됨</small>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Panel>
  );
}
