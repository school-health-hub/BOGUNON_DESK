import { Search, SlidersHorizontal } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { DashboardEditorPanel } from "../../../src/components/dashboard/useDesktopNavigation";
import { ToolCard } from "../ToolCard";
import { getVisibleToolDefinitions, matchesToolSearch, toolGroups, type ToolId } from "./toolDefinitions";

type ToolboxMenuProps = {
  readonly onRun: (id: ToolId) => void;
  readonly onOpenWorkspaceEditor: (panel: Exclude<DashboardEditorPanel, null>) => void;
};

export function ToolboxMenu({ onRun, onOpenWorkspaceEditor }: ToolboxMenuProps) {
  const [query, setQuery] = useState("");
  const searchDescriptionId = useId();
  const tools = useMemo(
    () => getVisibleToolDefinitions(import.meta.env.DEV).filter((tool) => matchesToolSearch(tool, query)),
    [query],
  );

  return (
    <div className="ux09-toolbox">
      <header className="ux09-toolbox__header">
        <div>
          <span className="ux09-toolbox__eyebrow">업무 도구</span>
          <h2>무엇을 도와드릴까요?</h2>
          <p>업무 이름이나 필요한 작업을 검색해 바로 시작하세요.</p>
        </div>
        <label className="ux09-tool-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">업무 도구 검색</span>
          <input
            type="search"
            value={query}
            aria-describedby={searchDescriptionId}
            placeholder="예: 공문, 일정, 물품"
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        <span className="sr-only" id={searchDescriptionId}>업무 이름과 설명을 검색합니다.</span>
      </header>

      <section className="ux09-customize" aria-labelledby="ux09-customize-title">
        <div>
          <span className="ux09-customize__icon" aria-hidden="true"><SlidersHorizontal size={18} /></span>
          <div><h2 id="ux09-customize-title">내 화면 꾸미기</h2><p>필요한 위젯만 보이게 하고 화면 분위기를 조정합니다.</p></div>
        </div>
        <div className="ux09-customize__actions">
          <button type="button" onClick={() => onOpenWorkspaceEditor("library")}>위젯 표시 설정</button>
          <button type="button" onClick={() => onOpenWorkspaceEditor("appearance")}>화면 스타일</button>
          <button type="button" onClick={() => onOpenWorkspaceEditor("dock")}>Dock 설정</button>
        </div>
      </section>

      {tools.length === 0 ? (
        <div className="ux09-toolbox__empty" role="status"><strong>검색 결과가 없습니다.</strong><span>다른 업무 이름이나 설명으로 검색해 보세요.</span></div>
      ) : toolGroups.map((group) => {
        const groupTools = tools.filter((tool) => tool.group === group.id);
        if (groupTools.length === 0) return null;
        return (
          <section className="ux09-tool-group" key={group.id} aria-labelledby={`ux09-group-${group.id}`}>
            <header><h2 id={`ux09-group-${group.id}`}>{group.title}</h2><p>{group.description}</p></header>
            <div className="p0-tools-grid">
              {groupTools.map((tool) => <ToolCard key={tool.id} icon={tool.icon} label={tool.title} description={tool.description} onClick={() => onRun(tool.id)} />)}
            </div>
          </section>
        );
      })}

      <details className="ux09-storage-note">
        <summary>저장·보안 안내</summary>
        <p>도구마다 저장 위치와 공유 범위가 다릅니다. 민감한 정보는 각 도구의 안내를 확인한 뒤 입력하고, AI 기능으로 보내기 전에는 개인정보를 다시 검토하세요.</p>
      </details>
    </div>
  );
}
