import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceData, WorkspaceDataState } from "../workspace-data/types";
import { NOTIFICATION_EMPTY_MESSAGE, NotificationWidget } from "./NotificationWidget";
import { DesktopPanelProvider } from "../components/desktop/DesktopPanelContext";
import { NotificationList } from "../components/NotificationList";

const hooks = vi.hoisted(() => ({
  state: { status: "loading" } as WorkspaceDataState,
  openBogunonTask: vi.fn(async () => undefined),
  openInbox: vi.fn(),
}));

vi.mock("../workspace-data/WorkspaceDataContext", () => ({
  useWorkspaceData: () => ({ state: hooks.state }),
}));

vi.mock("../components/desktop/DesktopPanelContext", () => ({
  useDesktopPanels: () => ({ openBogunonTask: hooks.openBogunonTask, openInbox: hooks.openInbox }),
  DesktopPanelProvider: ({ children }: { readonly children: ReactNode }) => children,
}));

const data = (notifications: WorkspaceData["notifications"]): WorkspaceData => ({
  todayTasks: [],
  calendarEvents: [],
  weekSchedule: [],
  upcomingEvents: [],
  ddayItems: [],
  notifications,
  inboxItems: [],
  summary: { todayEventCount: 0, todayTaskCount: 0, incompleteTaskCount: 0 },
});

const renderWidget = (): string => renderToStaticMarkup(
  createElement(DesktopPanelProvider, {
    notify: () => undefined,
    openBogunonTask: hooks.openBogunonTask,
    openInbox: hooks.openInbox,
    openQuickAddEventForDate: () => undefined,
    openQuickAddFromMemo: () => undefined,
    openQuickMemoUrl: async () => undefined,
    runDesktopAction: async () => undefined,
    workFolderFavorites: [],
    openWorkFolderFavorite: async () => undefined,
    children: createElement(NotificationWidget),
  }),
);

describe("Notification widget", () => {
  beforeEach(() => {
    hooks.state = { status: "loading" };
    hooks.openBogunonTask.mockClear();
    hooks.openInbox.mockClear();
  });

  it.each([
    ["loading", "BOGUNON 데이터를 불러오는 중입니다."],
    ["signedOut", "설정에서 Google 계정을 연결하면 BOGUNON 데이터를 볼 수 있습니다."],
    ["error", "데이터를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요."],
  ] as const)("renders the %s workspace notice", (status, message) => {
    hooks.state = { status };

    expect(renderWidget()).toContain(message);
  });

  it("renders the attention-feed empty state", () => {
    hooks.state = { status: "ready", data: data([]) };

    const html = renderWidget();
    expect(html).toContain(NOTIFICATION_EMPTY_MESSAGE);
    expect(html).not.toContain("결핵검진 명단 확인 필요");
  });

  it.each([1, 2, 3, 4])("renders %i real notification items with existing tones", (count) => {
    hooks.state = { status: "ready", data: data(Array.from({ length: count }, (_, index) => ({
      id: `notification-${index}`,
      title: `실제 업무 ${index + 1}`,
      detail: index % 2 === 0 ? "오늘 마감" : "회신 대기",
      relevantDate: index % 2 === 0 ? "2026-10-01" : null,
      tone: index % 2 === 0 ? "warning" : "info",
    }))) };

    const html = renderWidget();
    expect((html.match(/<li>/g) ?? [])).toHaveLength(count);
    expect(html).toContain("notification-list");
    expect(html).toContain("전체 보기");
    expect(html).toContain("실제 업무 1");
    expect(html).not.toContain("AED 점검표가 준비되었습니다");
  });

  it("opens an individual notification through the existing exact-task callback", async () => {
    hooks.state = { status: "ready", data: data([{ id: "task-1", title: "확인 업무", detail: "오늘 마감", relevantDate: "2026-10-01", tone: "warning" }]) };
    const widget = NotificationWidget();
    const list = collectElements(widget).find(({ type }) => type === NotificationList);
    expect(list).toBeDefined();
    const listElement = list?.type === NotificationList ? NotificationList(list.props as Parameters<typeof NotificationList>[0]) : null;
    const button = collectElements(listElement).find(({ type }) => type === "button");

    await (button?.props as { readonly onClick: () => Promise<void> }).onClick();
    expect(hooks.openBogunonTask).toHaveBeenCalledWith("task-1", "2026-10-01");
  });

  it("keeps the all-items action connected to Inbox", () => {
    hooks.state = { status: "ready", data: data([]) };
    const widget = NotificationWidget();
    const action = (widget.props as { readonly action?: ReactElement }).action;
    expect(action).toBeDefined();
    (action?.props as { readonly onClick: () => void }).onClick();
    expect(hooks.openInbox).toHaveBeenCalledOnce();
  });
});

function collectElements(node: ReactNode, result: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) node.forEach((child) => collectElements(child, result));
  else if (isValidElement(node)) {
    result.push(node);
    collectElements((node.props as { readonly children?: ReactNode }).children, result);
  }
  return result;
}
