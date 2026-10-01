import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { filterInboxItems, InboxPanel, InboxTaskRow } from "./InboxPanel";
import { InboxTaskActionPopover } from "./InboxTaskActionPopover";
import { createInboxTaskActionDraft } from "./inboxTaskActionEditor";
import type { WorkspaceDataState, WorkspaceInboxItem } from "../../workspace-data/types";

const ready: WorkspaceDataState = {
  status: "ready",
  data: {
    todayTasks: [], calendarEvents: [], weekSchedule: [], upcomingEvents: [], ddayItems: [], notifications: [],
    inboxItems: [{
      id: "one", title: "확인 업무", reason: "needsCheck", detail: "BOGUNON 확인 필요", priority: "high",
      status: "needsCheck", followUpDate: "2026-10-03", updatedAt: "2026-10-01T09:00:00.000Z",
      relevantDate: null, area: "healthWork", completed: false, tone: "warning",
    }],
    summary: { todayEventCount: 0, todayTaskCount: 0, incompleteTaskCount: 0 },
  },
};

const render = (state: WorkspaceDataState = ready): string => renderToStaticMarkup(
  <InboxPanel state={state} pendingTaskId={null} mutationError={null} onClose={() => undefined} onOpen={() => undefined} onSetActionState={async () => "success"} onSetCompleted={async () => "success"} />,
);

const collectElements = (node: ReactNode, result: ReactElement[] = []): ReactElement[] => {
  if (Array.isArray(node)) node.forEach((child) => collectElements(child, result));
  else if (isValidElement(node)) {
    result.push(node);
    collectElements((node.props as { readonly children?: ReactNode }).children, result);
  }
  return result;
};

const item = ready.status === "ready" ? ready.data.inboxItems[0] : undefined;

const rowButtons = (
  inboxItem: WorkspaceInboxItem,
  onOpen = vi.fn(),
  onSetCompleted = vi.fn(async () => "success" as const),
  onOpenActions = vi.fn(),
) => (
  collectElements(InboxTaskRow({ item: inboxItem, isPending: false, onOpen, onSetCompleted, onOpenActions, actionContent: null }))
    .filter(({ type }) => type === "button")
);

describe("InboxPanel", () => {
  it("renders the actionable list, count, filters, and completion control", () => {
    const html = render();
    expect(html).toContain("미처리 업무");
    expect(html).toContain("1건");
    expect(html).toContain("전체");
    expect(html).toContain("확인·회신");
    expect(html).toContain("확인 업무");
    expect(html).toContain("확인 업무 완료");
  });

  it.each([
    [{ status: "loading" } as const, "BOGUNON 데이터를 불러오는 중입니다."],
    [{ status: "signedOut" } as const, "설정에서 Google 계정을 연결하면 BOGUNON 데이터를 볼 수 있습니다."],
    [{ status: "error" } as const, "데이터를 불러오지 못했습니다."],
  ])("renders workspace state notices", (state, message) => expect(render(state)).toContain(message));

  it("renders the positive empty state", () => {
    const state: WorkspaceDataState = { status: "ready", data: { ...ready.data, inboxItems: [] } };
    expect(render(state)).toContain("지금 확인할 미처리 업무가 없습니다.");
  });

  it("filters deadline, follow-up, and attention groups without changing source order", () => {
    const item = ready.status === "ready" ? ready.data.inboxItems[0] : undefined;
    expect(item).toBeDefined();
    if (item === undefined) return;
    const items = [
      { ...item, id: "overdue", reason: "overdue" as const },
      { ...item, id: "today", reason: "dueToday" as const },
      { ...item, id: "follow", reason: "followUp" as const },
      { ...item, id: "needs", reason: "needsCheck" as const },
      { ...item, id: "waiting", reason: "waitingForReply" as const },
    ];
    expect(filterInboxItems(items, "deadline").map(({ id }) => id)).toEqual(["overdue", "today"]);
    expect(filterInboxItems(items, "followUp").map(({ id }) => id)).toEqual(["follow"]);
    expect(filterInboxItems(items, "attention").map(({ id }) => id)).toEqual(["needs", "waiting"]);
  });

  it("disables completion while another task is pending and shows mutation errors", () => {
    const html = renderToStaticMarkup(
      <InboxPanel state={ready} pendingTaskId="one" mutationError="완료 상태를 저장하지 못했습니다." onClose={() => undefined} onOpen={() => undefined} onSetActionState={async () => "error"} onSetCompleted={async () => "error"} />,
    );
    expect(html).toContain("disabled");
    expect(html).toContain("완료 상태를 저장하지 못했습니다.");
  });

  it("opens the exact task from the semantic title button", async () => {
    expect(item).toBeDefined();
    if (item === undefined) return;
    const onOpen = vi.fn();
    const buttons = rowButtons(item, onOpen);
    const openButton = buttons.find(({ props }) => (props as { readonly "aria-label"?: string })["aria-label"] === "BOGUNON에서 확인 업무 열기");

    expect((openButton?.props as { readonly type?: string }).type).toBe("button");
    await (openButton?.props as { readonly onClick: () => Promise<void> }).onClick();
    expect(onOpen).toHaveBeenCalledWith("one", null);
  });

  it("keeps completion separate from task navigation", async () => {
    expect(item).toBeDefined();
    if (item === undefined) return;
    const onOpen = vi.fn();
    const onSetCompleted = vi.fn(async () => "success" as const);
    const buttons = rowButtons(item, onOpen, onSetCompleted);
    const completionButton = buttons.find(({ props }) => (props as { readonly "aria-label"?: string })["aria-label"] === "확인 업무 완료");

    await (completionButton?.props as { readonly onClick: () => Promise<void> }).onClick();
    expect(onSetCompleted).toHaveBeenCalledWith(item, true);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("keeps the task action button separate from navigation and completion", () => {
    expect(item).toBeDefined();
    if (item === undefined) return;
    const onOpen = vi.fn();
    const onSetCompleted = vi.fn(async () => "success" as const);
    const onOpenActions = vi.fn();
    const actionButton = rowButtons(item, onOpen, onSetCompleted, onOpenActions)
      .find(({ props }) => (props as { readonly "aria-label"?: string })["aria-label"] === "확인 업무 상태와 후속 확인일 편집");

    expect((actionButton?.props as { readonly "aria-haspopup"?: string })["aria-haspopup"]).toBe("dialog");
    (actionButton?.props as { readonly onClick: () => void }).onClick();
    expect(onOpenActions).toHaveBeenCalledWith(item);
    expect(onOpen).not.toHaveBeenCalled();
    expect(onSetCompleted).not.toHaveBeenCalled();
  });

  it("renders the compact editor with current values and no completed option", () => {
    expect(item).toBeDefined();
    if (item === undefined) return;
    const html = renderToStaticMarkup(
      <InboxTaskActionPopover
        draft={createInboxTaskActionDraft(item)}
        error={null}
        isSaving={false}
        item={item}
        onCancel={() => undefined}
        onClearFollowUpDate={() => undefined}
        onFollowUpDateChange={() => undefined}
        onOpenDetail={() => undefined}
        onSave={() => undefined}
        onStatusChange={() => undefined}
      />,
    );
    expect(html).toContain("현재 상태");
    expect(html).toContain("후속 확인일");
    expect(html).toContain("2026-10-03");
    expect(html).toContain("진행 중");
    expect(html).toContain("회신 대기");
    expect(html).toContain("BOGUNON에서 자세히 편집");
    expect(html).not.toContain("value=\"completed\"");
  });
});
