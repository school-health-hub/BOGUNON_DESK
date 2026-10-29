import { CalendarRange, CheckSquare2, Clock3, Flag, LayoutGrid, RotateCcw, Settings2, Sparkles, SunMedium } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GridLayout, type Layout } from "react-grid-layout";
import { CalendarSurfaceWidget } from "./components/CalendarSurfaceWidget";
import { ClockSurfaceWidget, DdaySurfaceWidget, LauncherSurfaceWidget, WeatherSurfaceWidget } from "./components/CompactSurfaceWidgets";
import { SurfaceFrame } from "./components/SurfaceFrame";
import { TaskSurfaceWidget } from "./components/TaskSurfaceWidget";
import { applyGridLayout, calculateGridMetrics, defaultSurfaceLayout, setWidgetVisibility, toGridLayout, type SurfaceLayout, type SurfaceLayoutStorage } from "./layout";
import type { SurfaceProjection, SurfaceWidgetId } from "./projection";
import type { SurfaceEditControl } from "./nativeBridge";

const widgetMeta = {
  calendar: { title: "월간 일정", icon: <CalendarRange size={16} />, tone: "work" },
  tasks: { title: "오늘 할 일", icon: <CheckSquare2 size={16} />, tone: "work" },
  dday: { title: "D-Day", icon: <Flag size={16} />, tone: "work" },
  clock: { title: "시계·날짜", icon: <Clock3 size={16} />, tone: "information" },
  weather: { title: "날씨", icon: <SunMedium size={16} />, tone: "information" },
  launcher: { title: "빠른 실행", icon: <LayoutGrid size={16} />, tone: "utility" },
} as const;

type Props = Readonly<{
  projection: SurfaceProjection;
  storage: SurfaceLayoutStorage;
  onOpenMain?: (actionId: SurfaceProjection["launchers"][number]["actionId"]) => void;
  initialLayout?: SurfaceLayout;
  initialEditing?: boolean;
  isBrowserPreview?: boolean;
  nativeEditCommand?: SurfaceEditControl | null;
}>;

export function SurfaceApp({ projection, storage, onOpenMain, initialLayout = defaultSurfaceLayout, initialEditing = false, isBrowserPreview = true, nativeEditCommand = null }: Props) {
  const [editing, setEditing] = useState(initialEditing);
  const [layout, setLayout] = useState<SurfaceLayout>(() => storage.load() ?? initialLayout);
  const editBaseline = useRef<SurfaceLayout | null>(initialEditing ? layout : null);
  const lastEditControlSequence = useRef(0);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const [now, setNow] = useState(() => new Date(projection.generatedAt));
  const [activity, setActivity] = useState("합성 미리보기 · 실제 데이터와 연결되지 않습니다.");
  useEffect(() => {
    const onResize = () => { setViewportWidth(window.innerWidth); setViewportHeight(window.innerHeight); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow((current) => new Date(current.getTime() + 1_000)), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!editing) storage.save(layout);
  }, [editing, layout, storage]);
  const beginEditing = useCallback(() => {
    setEditing((current) => {
      if (!current) editBaseline.current = layout;
      return true;
    });
  }, [layout]);
  const completeEditing = useCallback(() => {
    editBaseline.current = null;
    setEditing(false);
  }, []);
  const cancelEditing = useCallback(() => {
    const baseline = editBaseline.current;
    if (baseline !== null) setLayout(baseline);
    editBaseline.current = null;
    setEditing(false);
  }, []);
  useEffect(() => {
    if (nativeEditCommand === null || nativeEditCommand.sequence <= lastEditControlSequence.current) return;
    lastEditControlSequence.current = nativeEditCommand.sequence;
    switch (nativeEditCommand.command) {
      case "BeginEdit": beginEditing(); break;
      case "CompleteEdit": completeEditing(); break;
      case "CancelEdit": cancelEditing(); break;
    }
  }, [beginEditing, cancelEditing, completeEditing, nativeEditCommand]);
  useEffect(() => {
    if (!editing) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") cancelEditing(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelEditing, editing]);
  const gridLayout = useMemo(() => toGridLayout(layout), [layout]);
  const gridMetrics = useMemo(() => calculateGridMetrics(layout, viewportHeight, editing), [editing, layout, viewportHeight]);
  const gridWidth = Math.max(800, viewportWidth - 48);
  const hidden = layout.widgets.filter(({ visible }) => !visible);
  const onGridChange = (next: Layout) => { if (editing) setLayout((current) => applyGridLayout(current, next)); };
  const hide = (id: SurfaceWidgetId) => setLayout((current) => setWidgetVisibility(current, id, false));
  const restoreDefault = () => { setLayout(defaultSurfaceLayout); setActivity("기본 합성 배치를 복원했습니다."); };
  return <main className={`surface-preview${editing ? " is-editing" : ""}${isBrowserPreview ? " is-browser-preview" : ""}`}>
    {(isBrowserPreview || editing) && <header className="surface-toolbar">
      <div className="surface-toolbar__identity"><span><Sparkles size={17} /></span><div><strong>{editing && !isBrowserPreview ? "Surface 편집 중" : "Desktop Surface 미리보기"}</strong><small>{editing ? "완료하거나 Escape로 취소하세요." : "브라우저 검토 화면 · 합성 데이터 전용"}</small></div></div>
      <div className="surface-toolbar__status" role="status">{activity}</div>
      <div className="surface-toolbar__actions">
        {editing && <button type="button" className="surface-button is-secondary" onClick={restoreDefault}><RotateCcw size={15} /> 기본 배치</button>}
        {editing && <button type="button" className="surface-button is-secondary" onClick={cancelEditing}>편집 취소</button>}
        <button type="button" className="surface-button" aria-pressed={editing} onClick={editing ? completeEditing : beginEditing}><Settings2 size={15} /> {editing ? "편집 완료" : "위젯 편집"}</button>
      </div>
    </header>}
    {editing && <aside className="surface-editor" aria-label="숨긴 위젯 관리">
      <span>카드 상단을 끌어 이동하고, 오른쪽 아래에서 크기를 조절하세요.</span>
      {hidden.map(({ id }) => <button type="button" key={id} onClick={() => setLayout((current) => setWidgetVisibility(current, id, true))}>+ {widgetMeta[id].title}</button>)}
    </aside>}
    <section className="surface-canvas" aria-label="Desktop Surface 위젯 미리보기" style={{ minHeight: gridMetrics.pixelHeight }}>
      <GridLayout className="surface-grid" width={gridWidth} layout={gridLayout} autoSize={false}
        dragConfig={{ enabled: editing, handle: ".surface-drag-handle", cancel: "button" }}
        resizeConfig={{ enabled: editing, handles: ["se"] }}
        gridConfig={{ cols: 12, rowHeight: gridMetrics.rowHeight, margin: [12, 12], containerPadding: null, maxRows: gridMetrics.rows }}
        onLayoutChange={onGridChange}>
        {layout.widgets.filter(({ visible }) => visible).map(({ id }) => {
          const meta = widgetMeta[id];
          return <div key={id} data-surface-widget={id}><SurfaceFrame title={meta.title} icon={meta.icon} editing={editing} tone={meta.tone} onHide={() => hide(id)}>
            {id === "calendar" && <CalendarSurfaceWidget events={projection.calendarEvents} now={now} onSyntheticAction={setActivity} />}
            {id === "tasks" && <TaskSurfaceWidget tasks={projection.tasks} />}
            {id === "dday" && <DdaySurfaceWidget items={projection.ddays} />}
            {id === "clock" && <ClockSurfaceWidget now={now} />}
            {id === "weather" && <WeatherSurfaceWidget weather={projection.weather} />}
            {id === "launcher" && <LauncherSurfaceWidget launchers={projection.launchers} disabled={editing} onLaunch={(launcher) => {
              onOpenMain?.(launcher.actionId);
              setActivity(onOpenMain === undefined ? `합성 실행 기록 · ${launcher.actionId}` : `Main 열기 요청 · ${launcher.label}`);
            }} />}
          </SurfaceFrame></div>;
        })}
      </GridLayout>
    </section>
  </main>;
}
