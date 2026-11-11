// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SurfaceSettings, type SurfaceSettingsCategory } from "../renderer/SurfaceSettings";

afterEach(cleanup);

const nodes = {
  account: <p>합성 계정</p>,
  school: <p>합성 학교</p>,
  appearance: <p>합성 화면</p>,
  widgets: <p>합성 위젯</p>,
  dock: <p>합성 Dock</p>,
  ai: <p>합성 AI</p>,
  about: <p>합성 정보</p>,
} as const;

function renderSettings(initialCategory: SurfaceSettingsCategory = "account") {
  return render(<SurfaceSettings {...nodes} initialCategory={initialCategory} saveStatus="저장됨" />);
}

it("presents the approved seven settings destinations in order", () => {
  renderSettings();
  const navigation = screen.getByRole("navigation", { name: "설정 메뉴" });
  expect(within(navigation).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual([
    "계정", "학교·연결", "화면·위젯", "Dock", "AI 연결", "이 PC", "앱 정보",
  ]);
  expect(screen.getByRole("heading", { name: "계정" })).toBeTruthy();
});

it("switches sections through desktop navigation and the compact selector", () => {
  renderSettings();
  fireEvent.click(screen.getByRole("button", { name: "학교·연결" }));
  expect(screen.getByText("합성 학교")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("설정 메뉴 선택"), { target: { value: "device" } });
  expect(screen.getByRole("heading", { name: "이 PC" })).toBeTruthy();
});

it("derives a truthful noninteractive storage support matrix from the registry", () => {
  renderSettings("device");
  expect(screen.getByText("이 PC에 저장")).toBeTruthy();
  expect(screen.getByText("이 PC에 암호화하여 저장")).toBeTruthy();
  expect(screen.getByText("현재 작업 중에만 유지")).toBeTruthy();
  expect(screen.getAllByText("학교 공동 공간").length).toBeGreaterThan(0);
  expect(screen.queryByRole("switch")).toBeNull();
  expect(screen.getByText(/자동 동기화하거나 저장 위치를 바꾸지 않습니다/)).toBeTruthy();
});

it("keeps appearance and widget owners in one settings section", () => {
  renderSettings("appearance");
  expect(screen.getByText("합성 화면")).toBeTruthy();
  expect(screen.getByText("합성 위젯")).toBeTruthy();
  expect(screen.getByText(/Desktop Mode/)).toBeTruthy();
});
