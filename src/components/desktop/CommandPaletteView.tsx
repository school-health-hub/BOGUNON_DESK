import { CalendarDays, FolderOpen, ListChecks, Search } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  commandGroupDefinitions,
  filterCommands,
} from "../../commands/commandRegistry";
import {
  handleCommandPaletteShortcut,
  resolveCommandKey,
  updateCommandQuery,
} from "../../commands/commandKeyboard";
import type { CommandDefinition, CommandId } from "../../commands/types";
import { buildPaletteItems, clampPaletteActiveIndex, executePaletteItem } from "../../commands/paletteItems";
import type { BogunonSearchItem, BogunonSearchState } from "../../workspace-search/types";
import type { WorkFolderFavorite } from "../../work-folders/types";
import { filterWorkFolderFavorites } from "../../work-folders/filterWorkFolderFavorites";

export type CommandPaletteViewProps = {
  readonly commands?:readonly CommandDefinition[];
  readonly useSearchState:(query:string,isOpen:boolean)=>BogunonSearchState;
  readonly showServerSearch?:boolean;
  readonly shortcutsEnabled?:boolean;
  readonly embedded?:boolean;
  readonly onError?:(message:string)=>void;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onCommand: (commandId: CommandId) => Promise<void>;
  readonly onSearchResult: (item: BogunonSearchItem) => Promise<void>;
  readonly onRequestOpen: () => void;
  readonly favorites: readonly WorkFolderFavorite[];
  readonly onFolder: (favorite: WorkFolderFavorite) => Promise<void>;
};

export function CommandPaletteView({ favorites, isOpen, onClose, onCommand, onFolder, onSearchResult, onRequestOpen, commands,useSearchState,showServerSearch=true,shortcutsEnabled=true,embedded=false,onError }: CommandPaletteViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRowRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [executionError,setExecutionError]=useState('');
  const results = useMemo(() => filterCommands(query,commands), [query,commands]);
  const searchState = useSearchState(query,isOpen);
  const folderResults = useMemo(() => filterWorkFolderFavorites(favorites, query), [favorites, query]);
  const selectableItems = useMemo(() => buildPaletteItems(results, folderResults, searchState), [folderResults, results, searchState]);
  const showBogunonSection = showServerSearch && query.trim().length >= 2;

  useEffect(() => {
    if(!shortcutsEnabled)return;
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if (isOpen && event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      handleCommandPaletteShortcut(event, {
        isOpen,
        onFocus: () => inputRef.current?.focus(),
        onOpen: onRequestOpen,
      });
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isOpen, onClose, onRequestOpen,shortcutsEnabled]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setActiveIndex(0);
    setExecutionError('');
    const ticket=window.requestAnimationFrame(() => inputRef.current?.focus());
    return ()=>window.cancelAnimationFrame(ticket);
  }, [isOpen]);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, query]);

  useEffect(() => {
    setActiveIndex((current) => clampPaletteActiveIndex(current, selectableItems.length));
  }, [selectableItems.length]);

  const executing=useRef(false);
  if (!isOpen) return null;
  const executeActive = async (index: number): Promise<void> => {
    const item = selectableItems[index];
    if (item === undefined || executing.current) return;
    executing.current=true;
    setExecutionError('');
    try{await executePaletteItem(item, {
      runCommand: (command) => onCommand(command.id),
      runFolder: onFolder,
      runSearchResult: onSearchResult,
    });}catch{const message="명령을 실행하지 못했습니다. 기존 작업을 유지합니다.";setExecutionError(message);onError?.(message);}finally{executing.current=false;}
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if(event.nativeEvent.isComposing||event.keyCode===229)return;
    const action = resolveCommandKey(event.key, activeIndex, selectableItems.length);
    if (action.type === "none") return;
    event.preventDefault();
    switch (action.type) {
      case "close":
        onClose();
        return;
      case "move":
        setActiveIndex(action.index);
        return;
      case "execute":
        void executeActive(action.index);
    }
  };

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className={embedded?"p0-command-palette":"command-palette-backdrop"} onMouseDown={embedded?undefined:closeFromBackdrop}>
      <section className="command-palette" role={embedded?undefined:"dialog"} aria-modal={embedded?undefined:true} aria-label="명령 팔레트">
        <div className="command-palette__search">
          <Search aria-hidden="true" />
          <input
            ref={inputRef}
            aria-label="명령 검색"
            autoComplete="off"
            placeholder="기능을 검색하세요"
            value={query}
            onChange={(event) => {
              const next = updateCommandQuery(event.currentTarget.value);
              setQuery(next.query);
              setActiveIndex(next.activeIndex);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd>Ctrl K</kbd>
        </div>

        <div className="command-palette__results" role="listbox" aria-label="명령 검색 결과">
          {executionError&&<p role="alert">{executionError}</p>}
          {results.length === 0 && folderResults.length===0 && !showBogunonSection ? (
            <p className="command-palette__empty">일치하는 기능이 없습니다.</p>
          ) : commandGroupDefinitions.map((group) => {
            const groupCommands = results.filter((command) => command.group === group.id);
            if (groupCommands.length === 0) return null;
            return (
              <section className="command-palette__group" role="group" aria-labelledby={`command-group-${group.id}`} key={group.id}>
                <h2 id={`command-group-${group.id}`}>{group.label}</h2>
                {groupCommands.map((command) => {
                  const index = selectableItems.findIndex((item) => item.kind === "command" && item.command.id === command.id);
                  const Icon = command.icon;
                  const active = index === activeIndex;
                  return (
                    <button
                      ref={active ? activeRowRef : undefined}
                      className={active ? "is-active" : ""}
                      type="button"
                      role="option"
                      aria-selected={active}
                      key={command.id}
                      onClick={() => void executeActive(index)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <span className="command-palette__icon"><Icon /></span>
                      <span className="command-palette__copy">
                        <strong>{command.label}</strong>
                        <small>{command.description}</small>
                      </span>
                    </button>
                  );
                })}
              </section>
            );
          })}
          {folderResults.length > 0 && (
            <section className="command-palette__group" role="group" aria-labelledby="command-group-local-folders">
              <h2 id="command-group-local-folders">이 PC의 폴더</h2>
              {folderResults.map((favorite) => {
                const index = selectableItems.findIndex((item) => item.kind === "folder" && item.favorite.id === favorite.id);
                const active = index === activeIndex;
                return (
                  <button ref={active ? activeRowRef : undefined} className={active ? "is-active" : ""} type="button" role="option" aria-selected={active} key={favorite.id} onClick={() => void executeActive(index)} onMouseEnter={() => setActiveIndex(index)}>
                    <span className="command-palette__icon"><FolderOpen /></span>
                    <span className="command-palette__copy"><strong>{favorite.name}</strong><small>{favorite.available ? favorite.displayPath : "폴더를 찾을 수 없음"}</small></span>
                  </button>
                );
              })}
            </section>
          )}
          {showBogunonSection && (
            <section className="command-palette__group command-palette__bogunon" role="group" aria-labelledby="command-group-bogunon-search">
              <h2 id="command-group-bogunon-search">BOGUNON 검색</h2>
              {searchState.status === "loading" && <p className="command-palette__status">검색 중...</p>}
              {searchState.status === "signedOut" && <p className="command-palette__status">BOGUNON 검색은 Google 계정 연결 후 사용할 수 있습니다.</p>}
              {searchState.status === "error" && <p className="command-palette__status is-error">BOGUNON 검색 결과를 불러오지 못했습니다.</p>}
              {searchState.status === "ready" && searchState.items.length === 0 && (
                <p className="command-palette__status">일치하는 업무나 일정이 없습니다.</p>
              )}
              {searchState.status === "ready" && searchState.items.map((item) => {
                const index = selectableItems.findIndex((candidate) => candidate.kind === item.kind && candidate.id === item.id);
                const active = index === activeIndex;
                const Icon = item.kind === "task" ? ListChecks : CalendarDays;
                return (
                  <button
                    ref={active ? activeRowRef : undefined}
                    className={active ? "is-active" : ""}
                    type="button"
                    role="option"
                    aria-selected={active}
                    key={`${item.kind}:${item.id}`}
                    onClick={() => void executeActive(index)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <span className="command-palette__icon"><Icon /></span>
                    <span className="command-palette__copy">
                      <strong>{item.title}</strong>
                      <small>{item.secondary}</small>
                    </span>
                  </button>
                );
              })}
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
