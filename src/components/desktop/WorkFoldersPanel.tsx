import { FolderOpen, Plus, X } from "lucide-react";
import { useEffect, type MouseEvent, type ReactNode } from "react";
import type { WorkFolderFavorite } from "../../work-folders/types";

type WorkFoldersPanelProps = {
  readonly favorites: readonly WorkFolderFavorite[];
  readonly isLoading: boolean;
  readonly onAdd: () => void;
  readonly onClose: () => void;
  readonly onOpen: (id: string) => void;
  readonly embedded?: boolean;
  readonly disabled?: boolean;
  readonly renderActions?: (favorite: WorkFolderFavorite, index: number) => ReactNode;
};

export function WorkFoldersPanel({ favorites, isLoading, onAdd, onClose, onOpen, embedded=false, disabled=false, renderActions }: WorkFoldersPanelProps) {
  useEffect(() => {
    if (embedded) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, embedded]);

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className={embedded ? "p0-work-folders" : "desktop-panel-backdrop"} onMouseDown={embedded ? undefined : closeFromBackdrop}>
      <section className="work-folders-panel" role={embedded ? undefined : "dialog"} aria-modal={embedded ? undefined : true} aria-labelledby="work-folders-title">
        <header className="work-folders-panel__header">
          <div>
            <h2 id="work-folders-title">업무 폴더</h2>
            <p>이 PC에 등록한 업무 폴더를 빠르게 엽니다.</p>
          </div>
          {!embedded && <button type="button" className="icon-button" aria-label="업무 폴더 닫기" onClick={onClose}><X /></button>}
        </header>
        <div className="work-folders-panel__list">
          {isLoading && <p className="desktop-panel-state">업무 폴더를 불러오는 중입니다.</p>}
          {!isLoading && favorites.length === 0 && <p className="desktop-panel-state">등록된 업무 폴더가 없습니다.</p>}
          {!isLoading && favorites.map((favorite, index) => (
            <div className={`work-folder-row${favorite.available ? "" : " is-unavailable"}`} key={favorite.id}>
              <FolderOpen aria-hidden="true" />
              <div><strong>{favorite.name}</strong><span title={favorite.path}>{favorite.available ? favorite.displayPath : "폴더를 찾을 수 없음"}</span></div>
              <button type="button" disabled={disabled || !favorite.available} aria-label={`${favorite.name} 폴더 열기`} onClick={() => onOpen(favorite.id)}>열기</button>
              {renderActions?.(favorite, index)}
            </div>
          ))}
        </div>
        <footer className="work-folders-panel__footer">
          <button type="button" className="secondary-button" disabled={disabled || favorites.length >= 12} onClick={onAdd}><Plus /> 폴더 추가</button>
        </footer>
      </section>
    </div>
  );
}
