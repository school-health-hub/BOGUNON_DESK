import { CalendarRange, CheckSquare2, Clock3, Flag, LayoutGrid, RotateCcw, Settings2, Sparkles, SunMedium } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GridLayout, type Layout } from "react-grid-layout";
import { CalendarSurfaceWidget } from "./components/CalendarSurfaceWidget";
import { ClockSurfaceWidget, DdaySurfaceWidget, LauncherSurfaceWidget, WeatherSurfaceWidget } from "./components/CompactSurfaceWidgets";
import { SurfaceFrame } from "./components/SurfaceFrame";
import { TaskSurfaceWidget } from "./components/TaskSurfaceWidget";
import { applyGridLayout, calculateGridMetrics, defaultSurfaceLayout, setWidgetVisibility, toGridLayout, type SurfaceLayout, type SurfaceLayoutStorage } from "./layout";
import type { SurfaceProjection, SurfaceWidgetId } from "./projection";

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
  initialLayout?: SurfaceLayout;
  initialEditing?: boolean;
}>;

export function SurfaceApp({ projection, storage, initialLayout = defaultSurfaceLayout, initialEditing = false }: Props) {
  const [editing, setEditing] = useState(initialEditing);
  const [layout, setLayout] = useState<SurfaceLayout>(() => storage.load() ?? initialLayout);
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
  useEffect(() => storage.save(layout), [layout, storage]);
  const gridLayout = useMemo(() => toGridLayout(layout), [layout]);
  const gridMetrics = useMemo(() => calculateGridMetrics(layout, viewportHeight, editing), [editing, layout, viewportHeight]);
  const gridWidth = Math.max(800, viewportWidth - 48);
  const hidden = layout.widgets.filter(({ visible }) => !visible);
  const onGridChange = (next: Layout) => { if (editing) setLayout((current) => applyGridLayout(current, next)); };
  const hide = (id: SurfaceWidgetId) => setLayout((current) => setWidgetVisibility(current, id, false));
  const restoreDefault = () => { setLayout(defaultSurfaceLayout); setActivity("기본 합성 배치를 복원했습니다."); };
  return <main className={`surface-preview${editing ? " is-editing" : ""}`}>
    <header className="surface-toolbar">
      <div className="surface-toolbar__identity"><span><Sparkles size={17} /></span><div><strong>Desktop Surface</strong><small>민트·아이보리 6개 위젯 · 합성 데이터 전용</small></div></div>
      <div className="surface-toolbar__status" role="status">{activity}</div>
      <div className="surface-toolbar__actions">
        {editing && <button type="button" className="surface-button is-secondary" onClick={restoreDefault}><RotateCcw size={15} /> 기본 배치</button>}
        <button type="button" className="surface-button" aria-pressed={editing} onClick={() => setEditing((current) => !current)}><Settings2 size={15} /> {editing ? "편집 완료" : "위젯 편집"}</button>
      </div>
    </header>
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
            {id === "launcher" && <LauncherSurfaceWidget launchers={projection.launchers} onLaunch={(launcher) => setActivity(`합성 실행 기록 · ${launcher.actionId}`)} />}
          </SurfaceFrame></div>;
        })}
      </GridLayout>
    </section>
  </main>;
}
