import { enabledWorkspaceAreas } from "../settings/workspaceFilters";
import type { BogunonTaskStatus } from "../workspace-data/types";
import type {
  BogunonSearchEventRow,
  BogunonSearchItem,
  BogunonSearchRequest,
  BogunonSearchState,
  BogunonSearchTaskRow,
} from "./types";

export const MIN_BOGUNON_SEARCH_LENGTH = 2;

const statusLabels = {
  planned: "예정",
  inProgress: "진행 중",
  waitingForReply: "회신 대기",
  needsCheck: "확인 필요",
  completed: "완료",
  onHold: "보류",
} as const satisfies Record<BogunonTaskStatus, string>;

const formatDate = (date: string): string => {
  const [, month, day] = date.split("-");
  return month === undefined || day === undefined ? date : `${Number(month)}.${day}`;
};

export const resolveTaskSearchDate = (task: BogunonSearchTaskRow): string | null => (
  task.scheduled_date ?? task.due_date ?? task.follow_up_date
);

const mapTask = (task: BogunonSearchTaskRow): BogunonSearchItem => {
  const date = resolveTaskSearchDate(task);
  return {
    kind: "task",
    id: task.id,
    title: task.title.trim(),
    date,
    secondary: ["업무", date === null ? null : formatDate(date), statusLabels[task.status]]
      .filter((value) => value !== null)
      .join(" · "),
  };
};

const mapEvent = (event: BogunonSearchEventRow): BogunonSearchItem => ({
  kind: "event",
  id: event.id,
  title: event.title.trim(),
  date: event.start_date,
  secondary: [
    "일정",
    formatDate(event.start_date),
    event.is_all_day ? null : event.start_time?.slice(0, 5) ?? null,
  ].filter((value) => value !== null).join(" · "),
});

export const searchBogunonItems = async (request: BogunonSearchRequest): Promise<BogunonSearchState> => {
  const query = request.query.trim();
  if (query.length < MIN_BOGUNON_SEARCH_LENGTH) return { status: "idle" };
  if (request.authStatus !== "signedIn" || request.userId === null) return { status: "signedOut" };
  const rows = await request.repository.search(
    request.userId,
    query,
    enabledWorkspaceAreas(request.filters),
  );
  return { status: "ready", items: [...rows.tasks.map(mapTask), ...rows.events.map(mapEvent)] };
};
