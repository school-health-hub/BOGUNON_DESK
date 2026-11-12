import { useRef, type KeyboardEvent, type ReactNode } from "react";
import {
  workspaceCategoryIds,
  workspaceCategoryRegistry,
  workspaceDefinitions,
  type WorkspaceCategoryId,
  type WorkspaceDefinition,
  type WorkspaceModuleId,
} from "../../src/navigation/workspaceRegistry";
import { PRODUCT_LOGO_URL } from "../../src/branding";

type AppShellProps = Readonly<{
  activeCategory: WorkspaceCategoryId;
  children: ReactNode;
  settings?: ReactNode;
  headerStatus?: ReactNode;
  workspace?: ReactNode;
  workspaceTitle?: string;
  persistentWorkspace?: ReactNode;
  persistentWorkspaceActive?: boolean;
  persistentWorkspaceTitle?: string;
  onCategoryChange: (categoryId: WorkspaceCategoryId) => void;
  onOpenModule: (moduleId: WorkspaceModuleId) => void;
  canOpenModule?: (moduleId: WorkspaceModuleId) => boolean;
}>;

const storageLabels = {
  device: "이 PC 저장",
  "device-encrypted": "이 PC 암호화 저장",
  session: "현재 작업 중",
  file: "사용자 파일",
  mixed: "이 PC·파일",
  "school-shared": "학교 공유 데이터",
  external: "외부 서비스",
} as const;

function availabilityLabel(definition: WorkspaceDefinition): string {
  if (definition.implementation === "conditional") return "연결·권한 확인 후 사용";
  if (definition.access === "configured-external") return "연결 주소 필요";
  if (definition.access === "school-role") return "승인된 학교 역할 필요";
  return "사용 가능";
}

function CategoryWorkspace({ categoryId, onOpenModule, canOpenModule }: Readonly<{ categoryId: Exclude<WorkspaceCategoryId, "home" | "settings">; onOpenModule: (moduleId: WorkspaceModuleId) => void; canOpenModule: (moduleId: WorkspaceModuleId) => boolean }>) {
  const category = workspaceCategoryRegistry[categoryId];
  const modules = workspaceDefinitions.filter((definition) => definition.categoryId === categoryId);
  return <section className="ux03-category" aria-labelledby={`ux03-${categoryId}-title`}>
    <header className="ux03-workspace-header">
      <div><p>BOGUNON DESK</p><h1 id={`ux03-${categoryId}-title`}>{category.label}</h1></div>
      <span>{modules.length}개 업무</span>
    </header>
    <div className="ux03-module-list">
      {modules.map((definition) => {
        const Icon = definition.icon;
        const isAvailable = canOpenModule(definition.id);
        const availability = isAvailable ? availabilityLabel(definition) : "현재 실행본에서 미지원";
        return <button className="ux03-module-row" key={definition.id} type="button" disabled={!isAvailable} onClick={() => onOpenModule(definition.id)} aria-label={`${definition.label} · ${availability}`}>
          <span className="ux03-module-icon" aria-hidden="true"><Icon size={21} strokeWidth={1.8}/></span>
          <span className="ux03-module-copy"><strong>{definition.label}</strong><small>{storageLabels[definition.storageScope]}</small></span>
          <span className={`ux03-availability is-${isAvailable ? definition.implementation : "unavailable"}`}>{availability}</span>
        </button>;
      })}
    </div>
  </section>;
}

export function AppShell({ activeCategory, children, settings, headerStatus, workspace, workspaceTitle, persistentWorkspace, persistentWorkspaceActive = false, persistentWorkspaceTitle, onCategoryChange, onOpenModule, canOpenModule = () => true }: AppShellProps) {
  const railRef = useRef<HTMLElement>(null);
  const onRailKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const lastIndex = workspaceCategoryIds.length - 1;
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = index === lastIndex ? 0 : index + 1;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = index === 0 ? lastIndex : index - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = lastIndex;
    if (nextIndex === null) return;
    event.preventDefault();
    railRef.current?.querySelectorAll<HTMLButtonElement>("button")[nextIndex]?.focus();
  };

  const activeLabel = workspaceCategoryRegistry[activeCategory].label;
  const currentWorkspaceTitle = workspaceTitle ?? (persistentWorkspaceActive ? persistentWorkspaceTitle : undefined);
  return <div className="ux03-shell">
    <aside className="ux03-rail">
      <div className="ux03-brand" aria-label="BOGUNON DESK"><img src={PRODUCT_LOGO_URL} alt=""/><strong>BOGUNON</strong></div>
      <nav ref={railRef} aria-label="주요 작업 공간">
        {workspaceCategoryIds.map((categoryId, index) => {
          const category = workspaceCategoryRegistry[categoryId];
          const Icon = category.icon;
          const isActive = categoryId === activeCategory;
          return <button key={categoryId} type="button" title={category.label} aria-current={isActive ? "page" : undefined} className={isActive ? "is-active" : ""} onKeyDown={(event) => onRailKeyDown(event, index)} onClick={() => onCategoryChange(categoryId)}>
            <Icon size={21} strokeWidth={1.8} aria-hidden="true"/><span>{category.label}</span>
          </button>;
        })}
      </nav>
    </aside>
    <div className="ux03-main">
      <header className="ux03-topbar"><span>현재 위치</span><strong>{currentWorkspaceTitle ? `${activeLabel} / ${currentWorkspaceTitle}` : activeLabel}</strong>{headerStatus&&<div className="ux03-topbar-status">{headerStatus}</div>}</header>
      <div className="ux03-outlet">
        <div className="ux03-home-slot" hidden={activeCategory !== "home" || Boolean(workspace) || persistentWorkspaceActive} inert={activeCategory !== "home" || Boolean(workspace) || persistentWorkspaceActive}>{children}</div>
        {persistentWorkspace && <div className="ux03-persistent-workspace" hidden={!persistentWorkspaceActive} inert={!persistentWorkspaceActive}>{persistentWorkspace}</div>}
        {workspace ? <div className="ux03-module-workspace">{workspace}</div> : !persistentWorkspaceActive && <>
          {activeCategory === "settings" && settings}
          {activeCategory !== "home" && activeCategory !== "settings" && <CategoryWorkspace categoryId={activeCategory} onOpenModule={onOpenModule} canOpenModule={canOpenModule}/>}
        </>}
      </div>
    </div>
  </div>;
}
