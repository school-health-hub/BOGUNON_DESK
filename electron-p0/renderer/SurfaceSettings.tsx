import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Bot, Building2, CircleUserRound, Info, LayoutDashboard, MonitorCog, PanelTop, type LucideIcon } from "lucide-react";
import { workspaceDefinitions, type WorkspaceStorageScope } from "../../src/navigation/workspaceRegistry";

export const surfaceSettingsCategories = ["account", "school", "appearance", "dock", "ai", "device", "about"] as const;
export type SurfaceSettingsCategory = (typeof surfaceSettingsCategories)[number];

type SettingsChoice = Readonly<{ id: SurfaceSettingsCategory; label: string; description: string; icon: LucideIcon }>;

const settingsChoices: readonly SettingsChoice[] = [
  { id: "account", label: "계정", description: "BOGUNON 로그인과 등록 학교", icon: CircleUserRound },
  { id: "school", label: "학교·연결", description: "이 PC의 학교와 업무 시스템 주소", icon: Building2 },
  { id: "appearance", label: "화면·위젯", description: "배경, 위젯 스타일과 표시 항목", icon: LayoutDashboard },
  { id: "dock", label: "Dock", description: "Dock 항목과 순서", icon: PanelTop },
  { id: "ai", label: "AI 연결", description: "AI 서비스와 개인정보 보호", icon: Bot },
  { id: "device", label: "이 PC", description: "기능별 데이터 보관 범위", icon: MonitorCog },
  { id: "about", label: "앱 정보", description: "제품 버전과 실행 환경", icon: Info },
] as const;

const storageDetails = {
  device: { label: "이 PC에 저장", description: "이 Windows 사용자 프로필 안에 보관합니다." },
  "device-encrypted": { label: "이 PC에 암호화하여 저장", description: "Windows의 보호 기능을 사용하며 다른 PC로 자동 전송하지 않습니다." },
  session: { label: "현재 작업 중에만 유지", description: "앱을 종료하면 사라질 수 있는 작업 상태입니다." },
  file: { label: "파일로 내보내기", description: "사용자가 선택한 파일로 저장하며 자동 업로드하지 않습니다." },
  mixed: { label: "이 PC와 파일", description: "작업 상태와 사용자가 내보낸 파일의 보관 범위가 다릅니다." },
  "school-shared": { label: "학교 공동 공간", description: "승인된 학교 역할과 서버 권한을 확인한 뒤 공동 데이터에 접근합니다." },
  external: { label: "외부 서비스 연결", description: "저장된 공식 주소로 외부 서비스를 열며 BOGUNON이 해당 데이터를 동기화하지 않습니다." },
} as const satisfies Record<WorkspaceStorageScope, Readonly<{ label: string; description: string }>>;

const modulesByStorage = workspaceDefinitions.reduce<Record<WorkspaceStorageScope, string[]>>((groups, definition) => {
  groups[definition.storageScope].push(definition.label);
  return groups;
}, { device: [], "device-encrypted": [], session: [], file: [], mixed: [], "school-shared": [], external: [] });

function DeviceStorageMatrix(): ReactNode {
  return <div className="ux04-storage">
    <div className="ux04-notice"><strong>기능마다 보관 방식이 다릅니다.</strong><p>이 화면은 현재 지원 범위를 설명합니다. 데이터를 자동 동기화하거나 저장 위치를 바꾸지 않습니다.</p></div>
    <div className="ux04-storage-list">{Object.entries(storageDetails).map(([scope, detail]) => {
      const storageScope = scope as WorkspaceStorageScope;
      return <article key={storageScope}><div><strong>{detail.label}</strong><p>{detail.description}</p></div><p className="ux04-storage-examples">{modulesByStorage[storageScope].join(" · ")}</p></article>;
    })}</div>
  </div>;
}

type SurfaceSettingsProps = Readonly<{
  account: ReactNode;
  school: ReactNode;
  appearance: ReactNode;
  widgets: ReactNode;
  desktopProfiles?: ReactNode;
  dock: ReactNode;
  ai: ReactNode;
  about: ReactNode;
  saveStatus: string;
  initialCategory?: SurfaceSettingsCategory;
}>;

export function SurfaceSettings({ account, school, appearance, widgets, desktopProfiles, dock, ai, about, saveStatus, initialCategory = "account" }: SurfaceSettingsProps) {
  const normalizedInitial = surfaceSettingsCategories.includes(initialCategory) ? initialCategory : "account";
  const [category, setCategory] = useState<SurfaceSettingsCategory>(normalizedInitial);
  const navRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const activeChoice = settingsChoices.find((choice) => choice.id === category) ?? settingsChoices[0];

  const onNavKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const lastIndex = settingsChoices.length - 1;
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = index === lastIndex ? 0 : index + 1;
    if (event.key === "ArrowUp") nextIndex = index === 0 ? lastIndex : index - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = lastIndex;
    if (nextIndex === null) return;
    event.preventDefault();
    navRef.current?.querySelectorAll<HTMLButtonElement>("button")[nextIndex]?.focus();
  };

  const content = category === "account" ? account
    : category === "school" ? school
    : category === "appearance" ? <div className="ux04-appearance-stack"><section aria-label="Workspace 기본 배치"><h3>Workspace 기본 배치</h3><section aria-label="화면 스타일">{appearance}</section><section aria-label="위젯 표시">{widgets}</section></section>{desktopProfiles ?? <section className="ux04-future" aria-label="Desktop Mode 준비"><strong>Desktop Mode</strong><p>향후 모니터별 위젯 화면을 이 위치에서 설정합니다. 현재 버전에서는 사용할 수 없습니다.</p><button type="button" disabled>준비 중</button></section>}</div>
    : category === "dock" ? dock
    : category === "ai" ? ai
    : category === "device" ? <DeviceStorageMatrix />
    : about;

  return <section className="ux04-settings" aria-labelledby={titleId}>
    <header className="ux04-settings-heading"><p>BOGUNON DESK</p><h1 id={titleId}>설정</h1><span>계정과 이 PC의 설정을 구분해 관리합니다.</span></header>
    <label className="ux04-compact-select">설정 메뉴 선택<select value={category} onChange={(event) => setCategory(event.target.value as SurfaceSettingsCategory)}>{settingsChoices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label>
    <div className="ux04-settings-layout">
      <nav ref={navRef} className="ux04-settings-nav" aria-label="설정 메뉴">{settingsChoices.map((choice, index) => {
        const Icon = choice.icon;
        const selected = choice.id === category;
        return <button key={choice.id} type="button" aria-label={choice.label} aria-current={selected ? "page" : undefined} className={selected ? "is-active" : ""} onKeyDown={(event) => onNavKeyDown(event, index)} onClick={() => setCategory(choice.id)}><Icon size={19} aria-hidden="true"/><span><strong>{choice.label}</strong><small>{choice.description}</small></span></button>;
      })}</nav>
      <main className="ux04-settings-content" aria-labelledby="ux04-section-title"><header><p>설정</p><h2 id="ux04-section-title">{activeChoice.label}</h2><span>{activeChoice.description}</span></header><div className="ux04-settings-body">{content}</div>{category !== "account" && category !== "school" && category !== "ai" && category !== "device" && category !== "about" && <p className="ux04-save-status" role="status">{saveStatus}</p>}</main>
    </div>
  </section>;
}
