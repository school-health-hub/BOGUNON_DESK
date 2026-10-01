import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultAppearance } from "../../dashboard/layouts";
import { AppearancePanel } from "./AppearancePanel";
import { DashboardToolbar } from "./DashboardToolbar";
import { PresetSelector } from "./PresetSelector";

const noop = () => undefined;

const renderToolbar = (activePanel: "library" | "presets" | "appearance" | "dock" | null): string =>
  renderToStaticMarkup(
    <DashboardToolbar
      activePanel={activePanel}
      isEditing
      onOpenPanel={noop}
      onOpenQuickAdd={noop}
      onReset={noop}
      onToggleEdit={noop}
    />,
  );

describe("customization editor", () => {
  it("renders the compact editing sequence with a visible active tool", () => {
    const markup = renderToolbar("appearance");

    expect(markup).toContain("끌어서 이동 · 모서리에서 크기 변경");
    expect(markup).toContain("위젯");
    expect(markup).toContain("배치");
    expect(markup).toContain("스타일");
    expect(markup).toContain("Dock");
    expect(markup).toContain('aria-label="기본 데스크형으로 초기화"');
    expect(markup).toContain("완료");
    expect(markup).toContain('aria-controls="workspace-style-panel" aria-pressed="true"');
    expect(markup).not.toContain("위젯 추가");
    expect(markup).not.toContain("Dock 편집</button>");
  });

  it("shows a preset as current only when the layout still identifies it", () => {
    const selected = renderToStaticMarkup(
      <PresetSelector currentPresetId="desk" onApply={noop} onClose={noop} />,
    );
    const custom = renderToStaticMarkup(
      <PresetSelector currentPresetId={undefined} onApply={noop} onClose={noop} />,
    );

    expect(selected).toContain("사용 중");
    expect(selected).toContain('aria-pressed="true"');
    expect(custom).not.toContain("preset-popover__current");
    expect(custom).not.toContain('aria-pressed="true"');
  });

  it("keeps the existing appearance choices and marks one choice in each group", () => {
    const markup = renderToStaticMarkup(
      <AppearancePanel appearance={defaultAppearance} onClose={noop} onUpdate={noop} />,
    );

    expect(markup).toContain("쿨 블루");
    expect(markup).toContain("화이트");
    expect(markup).toContain("웜 그레이");
    expect(markup).toContain("민트");
    expect(markup).toContain("라벤더");
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(3);
  });
});
