import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { WorkFolderFavorite } from "../work-folders/types";
import { QuickLauncherWidget, selectQuickLauncherFolders } from "./QuickLauncherWidget";

const panelMocks = vi.hoisted(() => ({
  runDesktopAction: vi.fn(async () => undefined),
  openWorkFolderFavorite: vi.fn(async () => undefined),
  workFolderFavorites: [] as readonly WorkFolderFavorite[],
}));

vi.mock("../components/desktop/DesktopPanelContext", () => ({
  useDesktopPanels: () => panelMocks,
}));

const favorites: readonly WorkFolderFavorite[] = [
  { id: "one", name: "보건일지", path: "C:/Health", displayPath: "C:\\Health", available: true },
  { id: "two", name: "오래된 자료", path: "D:/Missing", displayPath: "D:\\Missing", available: false },
];

const renderWidget = (): string => {
  panelMocks.workFolderFavorites = favorites;
  return renderToStaticMarkup(createElement(QuickLauncherWidget));
};

const collectElements = (node: ReactNode, result: ReactElement[] = []): ReactElement[] => {
  if (Array.isArray(node)) {
    node.forEach((child) => collectElements(child, result));
  } else if (isValidElement(node)) {
    result.push(node);
    collectElements((node.props as { children?: ReactNode }).children, result);
  }
  return result;
};

const getButtons = (): ReactElement[] => collectElements(QuickLauncherWidget()).filter(({ type }) => type === "button");

describe("QuickLauncherWidget", () => {
  it("renders central actions and device-only context accessibly", () => {
    const markup = renderWidget();
    expect(markup).toContain('aria-label="온라인 보건실"');
    expect(markup).toContain('aria-label="BOGUNON"');
    expect(markup).toContain('aria-label="업무포털"');
    expect(markup).toContain("이 기기");
    expect(markup).toContain("모두 보기");
  });

  it("keeps unavailable folders visible and disabled", () => {
    const markup = renderWidget();
    expect(markup).toContain('aria-label="보건일지 폴더 열기"');
    expect(markup).toContain('aria-label="오래된 자료 폴더를 사용할 수 없음"');
    expect(markup).toContain("disabled");
    expect(markup).toContain("연결 안 됨");
  });

  it("selects at most four folders while preserving their order", () => {
    const many = Array.from({ length: 6 }, (_, index) => ({ ...favorites[0], id: String(index), name: `폴더 ${index}` }));
    expect(selectQuickLauncherFolders(many).map(({ id }) => id)).toEqual(["0", "1", "2", "3"]);
  });

  it("executes fixed destinations through the central action runner", async () => {
    panelMocks.workFolderFavorites = favorites;
    panelMocks.runDesktopAction.mockClear();
    const button = getButtons().find(({ props }) => (props as { "aria-label"?: string })["aria-label"] === "BOGUNON");
    expect(button).toBeDefined();
    await (button?.props as { onClick: () => Promise<void> }).onClick();
    expect(panelMocks.runDesktopAction).toHaveBeenCalledWith("bogunon");
  });

  it("wires available folders while keeping unavailable folders inert", async () => {
    panelMocks.workFolderFavorites = favorites;
    panelMocks.openWorkFolderFavorite.mockClear();
    const buttons = getButtons();
    const available = buttons.find(({ props }) => (props as { "aria-label"?: string })["aria-label"] === "보건일지 폴더 열기");
    const unavailable = buttons.find(({ props }) => (props as { "aria-label"?: string })["aria-label"] === "오래된 자료 폴더를 사용할 수 없음");

    expect((unavailable?.props as { disabled?: boolean }).disabled).toBe(true);
    expect((unavailable?.props as { onClick?: unknown }).onClick).toBeUndefined();
    await (available?.props as { onClick: () => Promise<void> }).onClick();
    expect(panelMocks.openWorkFolderFavorite).toHaveBeenCalledTimes(1);
    expect(panelMocks.openWorkFolderFavorite).toHaveBeenCalledWith(favorites[0]);
  });
});
