import { GridLayout, type Layout } from "react-grid-layout";
import { Sparkles } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useWidgetSession } from "../../dashboard/WidgetSessionContext";
import { DesktopSettingsPanel } from "../desktop/DesktopSettingsPanel";
import { CommandPalette } from "../desktop/CommandPalette";
import { QuickAddPanel } from "../desktop/QuickAddPanel";
import { ToolboxPanel } from "../desktop/ToolboxPanel";
import { InboxPanel } from "../desktop/InboxPanel";
import { CalculatorPanel } from "../desktop/CalculatorPanel";
import { QuickMemoPanel } from "../desktop/QuickMemoPanel";
import { WorkFoldersPanel } from "../desktop/WorkFoldersPanel";
import { PurchaseHelperPanel } from "../desktop/PurchaseHelperPanel";
import { OfficialDocumentPanel } from "../desktop/OfficialDocumentPanel";
import { RecordHelperPanel } from "../desktop/RecordHelperPanel";
import { DesktopPanelProvider } from "../desktop/DesktopPanelContext";
import { createQuickAddOpenState, type QuickAddOpenOptions } from "./quickAddOpenState";
import { AppDock } from "../../dock/AppDock";
import { DockEditor } from "../../dock/DockEditor";
import type { DockLayout } from "../../dock/types";
import { getDesktopErrorMessage, isDesktopRuntime, openBogunonSearchResult, openQuickMemoUrl } from "../../desktop/actions";
import { parseDesktopActionId, type BogunonSearchResultTarget } from "../../desktop/types";
import { createDefaultDashboardLayout } from "../../dashboard/layouts";
import { hideWidget, mergeGridLayout, restoreWidget, toGridLayout } from "../../dashboard/layoutTransforms";
import type { DashboardAppearance, DashboardLayout, WidgetType } from "../../dashboard/types";
import { settingsService } from "../../settings/settingsService";
import { accountSyncService } from "../../settings/accountSyncService";
import { DashboardToolbar } from "./DashboardToolbar";
import { AppearancePanel } from "./AppearancePanel";
import { PresetSelector } from "./PresetSelector";
import { applyPreset, calculateDashboardGridMetrics, getWorkspaceModeClassName, RESET_DASHBOARD_CONFIRMATION, resetDashboardLayout, resolveDashboardGridWidth, useElementWidth, useViewportHeight } from "./dashboardCanvasSupport";
import { WidgetFrame } from "./WidgetFrame";
import { WidgetLibraryDrawer } from "./WidgetLibraryDrawer";
import { useDesktopNavigation, type DashboardEditorPanel } from "./useDesktopNavigation";
import { useWorkspaceData } from "../../workspace-data/WorkspaceDataContext";
import {
  WorkItemCreateError,
  workItemCreateRepository,
} from "../../workspace-data/workItemCreateRepository";
import {
  formatLocalInputDate,
  QuickAddValidationError,
  submitQuickWorkItem,
  type QuickAddInput,
} from "../../workspace-data/workItemCreateService";
import { executeCommand } from "../../commands/commandRegistry";
import type { CommandId } from "../../commands/types";
import type { BogunonSearchItem } from "../../workspace-search/types";
import { useWorkspaceNotifications } from "../../notifications/useWorkspaceNotifications";
import { toolboxToolRegistry, type ToolboxToolId } from "../../tools/toolRegistry";
import type { WorkFolderFavorite } from "../../work-folders/types";
import { workFolderService } from "../../work-folders/workFolderService";
import type { PurchaseAnalysisResult, PurchaseDraft, PurchaseDraftTemplate, PurchaseImportTemplate, PurchaseItem, PurchaseMappingCandidate, PurchaseSettlement, PurchaseSourceSummary } from "../../purchase/types";
import { useOnboarding } from "../../onboarding/OnboardingContext";
import { useDesktopUpdater } from "../../updater/DesktopUpdaterContext";
import { DesktopUpdateBanner } from "../desktop/DesktopUpdateBanner";
import { DesktopUpdateConfirmationDialog } from "../desktop/DesktopUpdateConfirmationDialog";

export function DashboardCanvas() {
  const auth = useAuth();
  const onboarding = useOnboarding();
  const updater = useDesktopUpdater();
  const { now } = useWidgetSession();
  const workspaceData = useWorkspaceData();
  useWorkspaceNotifications(auth.state.status, workspaceData.state, now);
  const { ref, width } = useElementWidth();
  const viewportHeight = useViewportHeight();
  const [dashboardLayout, setDashboardLayout] = useState<DashboardLayout>(() => settingsService.account.loadWorkspace());
  const [dockLayout, setDockLayout] = useState<DockLayout>(() => settingsService.account.loadDock());
  const [isEditing, setIsEditing] = useState(false);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<DashboardEditorPanel>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddInitial, setQuickAddInitial] = useState(() => createQuickAddOpenState(formatLocalInputDate(now)));
  const [isQuickAddSaving, setIsQuickAddSaving] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isPurchaseHelperOpen, setIsPurchaseHelperOpen] = useState(false);
  const [isOfficialDocumentOpen, setIsOfficialDocumentOpen] = useState(false);
  const [isRecordHelperOpen, setIsRecordHelperOpen] = useState(false);
  const [purchaseItems, setPurchaseItems] = useState<readonly PurchaseItem[]>([]);
  const [purchaseSources, setPurchaseSources] = useState<readonly PurchaseSourceSummary[]>([]);
  const [purchaseCandidates, setPurchaseCandidates] = useState<readonly PurchaseMappingCandidate[]>([]);
  const [purchaseDraft, setPurchaseDraft] = useState<PurchaseDraft | null>(null);
  const [purchaseSettlement, setPurchaseSettlement] = useState<PurchaseSettlement | null>(null);
  const appendPurchaseAnalysis = useCallback((result: PurchaseAnalysisResult) => {
    setPurchaseItems((current) => [...current, ...result.items]);
    setPurchaseSources((current) => [...current, ...result.sources]);
    setPurchaseCandidates((current) => [...current, ...result.candidates]);
  }, []);
  const [purchaseColumns, setPurchaseColumns] = useState(() => settingsService.account.loadPurchaseOutputColumns());
  const [purchaseImportTemplates, setPurchaseImportTemplates] = useState<readonly PurchaseImportTemplate[]>(() => settingsService.account.loadPurchaseImportTemplates());
  const [purchaseDraftTemplates, setPurchaseDraftTemplates] = useState<readonly PurchaseDraftTemplate[]>(() => settingsService.account.loadPurchaseDraftTemplates());
  const [isQuickMemoOpen, setIsQuickMemoOpen] = useState(false);
  const [isWorkFoldersOpen, setIsWorkFoldersOpen] = useState(false);
  const [workFolderFavorites, setWorkFolderFavorites] = useState<readonly WorkFolderFavorite[]>([]);
  const [isLoadingWorkFolders, setIsLoadingWorkFolders] = useState(false);
  const navigation = useDesktopNavigation({
    setActivePanel,
    setIsEditing,
    setIsCalculatorOpen,
    setIsPurchaseHelperOpen,
    setIsOfficialDocumentOpen,
    setIsRecordHelperOpen,
    setIsInboxOpen,
    setIsQuickMemoOpen,
    setIsWorkFoldersOpen,
    setNotice,
    setSelectedWidgetId,
  });
  const {
    activeActionId,
    isDesktopSettingsOpen,
    openSettingsSection,
    openWorkspaceEditor,
    runDesktopAction,
    toolbox,
    settingsSectionId,
  } = navigation;
  const gridWidth = resolveDashboardGridWidth(width);
  const isCompact = width !== null && width < 900;

  const refreshWorkFolders = async (): Promise<void> => {
    setIsLoadingWorkFolders(true);
    try {
      setWorkFolderFavorites(await workFolderService.load());
    } catch (error: unknown) {
      setNotice(getDesktopErrorMessage(error));
    } finally {
      setIsLoadingWorkFolders(false);
    }
  };

  useEffect(() => { void refreshWorkFolders(); }, []);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => void updater.startupCheck(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [updater.startupCheck]);
  useEffect(() => {
    if (isWorkFoldersOpen) void refreshWorkFolders();
  }, [isWorkFoldersOpen]);

  useEffect(() => {
    if (isEditing || isDesktopSettingsOpen || toolbox.isToolboxOpen || isInboxOpen || isCalculatorOpen || isPurchaseHelperOpen || isOfficialDocumentOpen || isRecordHelperOpen || isQuickMemoOpen || isWorkFoldersOpen) setIsQuickAddOpen(false);
  }, [isCalculatorOpen, isPurchaseHelperOpen, isOfficialDocumentOpen, isRecordHelperOpen, isDesktopSettingsOpen, isEditing, isInboxOpen, isQuickMemoOpen, isWorkFoldersOpen, toolbox.isToolboxOpen]);

  useEffect(() => {
    if (isQuickAddOpen || isDesktopSettingsOpen || toolbox.isToolboxOpen || isInboxOpen || isCalculatorOpen || isPurchaseHelperOpen || isOfficialDocumentOpen || isRecordHelperOpen || isQuickMemoOpen || isWorkFoldersOpen) setIsCommandPaletteOpen(false);
  }, [isCalculatorOpen, isPurchaseHelperOpen, isOfficialDocumentOpen, isRecordHelperOpen, isDesktopSettingsOpen, isInboxOpen, isQuickAddOpen, isQuickMemoOpen, isWorkFoldersOpen, toolbox.isToolboxOpen]);

  useEffect(() => settingsService.account.saveWorkspace(dashboardLayout), [dashboardLayout]);
  useEffect(() => settingsService.account.saveDock(dockLayout), [dockLayout]);
  useEffect(() => accountSyncService.subscribeApplied((settings) => {
    setDashboardLayout(settings.workspace);
    setDockLayout(settings.dock);
    setPurchaseColumns(settings.purchaseOutputColumns);
    setPurchaseImportTemplates(settings.purchaseImportTemplates);
    setPurchaseDraftTemplates(settings.purchaseDraftTemplates);
  }), []);

  useEffect(() => {
    void settingsService.device.setCloseToTray(
      settingsService.device.getCloseToTray(),
    ).catch((error: unknown) => {
      setNotice(getDesktopErrorMessage(error));
    });
  }, []);

  useEffect(() => {
    if (notice === null) return undefined;
    const timeoutId = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (!isDesktopRuntime()) return undefined;
    let unlisten: (() => void) | null = null;
    let active = true;
    void listen<string>("desktop:navigate", (event) => {
      const actionId = parseDesktopActionId(event.payload);
      if (actionId !== null) void runDesktopAction(actionId);
    }).then((dispose) => {
      if (active) unlisten = dispose;
      else dispose();
    }).catch((error: unknown) => {
      setNotice(getDesktopErrorMessage(error));
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, [runDesktopAction]);

  useEffect(() => {
    if (!isDesktopRuntime()) return undefined;
    let unlisten: (() => void) | null = null;
    let active = true;
    void listen<string>("desktop:notice", (event) => setNotice(event.payload)).then((dispose) => {
      if (active) unlisten = dispose;
      else dispose();
    }).catch((error: unknown) => {
      setNotice(getDesktopErrorMessage(error));
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  const gridLayout = useMemo(() => toGridLayout(dashboardLayout.widgets, isEditing && !isCompact), [dashboardLayout.widgets, isEditing, isCompact]);
  const visibleWidgets = dashboardLayout.widgets.filter((widget) => widget.visible);
  const visibleRowCount = Math.max(1, ...visibleWidgets.map((widget) => widget.y + widget.h));
  const gridMetrics = calculateDashboardGridMetrics(viewportHeight, visibleRowCount);

  const updateAppearance = (appearance: DashboardAppearance) => {
    setDashboardLayout((current) => ({ ...current, appearance }));
  };

  const resetDashboard = () => {
    if (window.confirm(RESET_DASHBOARD_CONFIRMATION)) {
      setDashboardLayout((current) => resetDashboardLayout(current));
      setActivePanel(null);
    }
  };

  const openQuickAdd = (options: QuickAddOpenOptions = {}) => {
    setIsCalculatorOpen(false);
    setIsPurchaseHelperOpen(false);
    setIsOfficialDocumentOpen(false);
    setIsRecordHelperOpen(false);
    setIsInboxOpen(false);
    setIsQuickMemoOpen(false);
    setIsWorkFoldersOpen(false);
    navigation.closeSettings();
    toolbox.closePanels();
    setIsCommandPaletteOpen(false);
    setQuickAddError(null);
    setQuickAddInitial(createQuickAddOpenState(formatLocalInputDate(now), options));
    setIsQuickAddOpen(true);
  };

  const openCommandPalette = () => {
    setIsCalculatorOpen(false);
    setIsPurchaseHelperOpen(false);
    setIsOfficialDocumentOpen(false);
    setIsRecordHelperOpen(false);
    setIsInboxOpen(false);
    setIsQuickAddOpen(false);
    setIsQuickMemoOpen(false);
    setIsWorkFoldersOpen(false);
    navigation.closeSettings();
    toolbox.closePanels();
    setIsCommandPaletteOpen(true);
  };

  const runCommand = async (commandId: CommandId): Promise<void> => {
    setIsCommandPaletteOpen(false);
    await executeCommand(commandId, {
      openQuickAdd: () => openQuickAdd(),
      runDesktopAction,
      openWorkspaceEditor,
      openWidgetLibrary: () => {
        openWorkspaceEditor("workspace");
        setActivePanel("library");
      },
    });
  };

  const openBogunonTarget = async (target: BogunonSearchResultTarget): Promise<void> => {
    try {
      const outcome = await openBogunonSearchResult(target);
      if (outcome.message !== null) setNotice(outcome.message);
    } catch (error: unknown) {
      setNotice(getDesktopErrorMessage(error));
    }
  };

  const runBogunonSearchResult = async (item: BogunonSearchItem): Promise<void> => {
    setIsCommandPaletteOpen(false);
    await openBogunonTarget({ kind: item.kind, id: item.id, date: item.date });
  };

  const openWorkFolderFavorite = async (favorite: WorkFolderFavorite): Promise<void> => {
    setIsCommandPaletteOpen(false);
    try {
      await workFolderService.open(favorite.id);
      setIsWorkFoldersOpen(false);
    } catch (error: unknown) {
      setNotice(getDesktopErrorMessage(error));
    }
  };

  const addWorkFolderFavorite = async (): Promise<void> => {
    try {
      const next = await workFolderService.pick();
      if (next !== null) setWorkFolderFavorites(next);
    } catch (error: unknown) {
      setNotice(getDesktopErrorMessage(error));
    }
  };

  const submitQuickAdd = async (input: QuickAddInput): Promise<void> => {
    setIsQuickAddSaving(true);
    setQuickAddError(null);
    try {
      const result = await submitQuickWorkItem({
        authStatus: auth.state.status,
        userId: auth.state.user?.id ?? null,
        input,
        repository: workItemCreateRepository,
        refresh: workspaceData.refresh,
      });
      if (result.status === "signedOut") {
        setQuickAddError("저장하려면 Google 계정을 연결해 주세요.");
        return;
      }
      setIsQuickAddOpen(false);
      setNotice(result.kind === "task"
        ? "BOGUNON에 업무를 추가했습니다."
        : "BOGUNON에 일정을 추가했습니다.");
    } catch (error: unknown) {
      setQuickAddError(error instanceof QuickAddValidationError || error instanceof WorkItemCreateError
        ? error.message
        : "저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setIsQuickAddSaving(false);
    }
  };

  const runToolboxItem = (toolId: ToolboxToolId): void => {
    const definition = toolboxToolRegistry[toolId];
    if (definition.kind === "internalTool") {
      void runDesktopAction(definition.launchActionId);
      return;
    }
    toolbox.runToolAction(definition.id);
  };

  return (
    <DesktopPanelProvider
      notify={setNotice}
      openBogunonTask={(taskId, date) => openBogunonTarget({ kind: "task", id: taskId, date })}
      openInbox={() => void runDesktopAction("inbox")}
      openQuickAddEventForDate={(date) => openQuickAdd({ initialDate: date, initialKind: "event" })}
      openQuickAddFromMemo={(title) => openQuickAdd({ initialTaskTitle: title })}
      openQuickMemoUrl={async (url) => {
        await openQuickMemoUrl(url);
      }}
      runDesktopAction={runDesktopAction}
      workFolderFavorites={workFolderFavorites}
      openWorkFolderFavorite={openWorkFolderFavorite}
    >
    <div className={`app-shell workspace-shell ${getWorkspaceModeClassName(isEditing)} bg-${dashboardLayout.appearance.background} card-${dashboardLayout.appearance.cardStyle} corner-${dashboardLayout.appearance.cornerStyle}`}>
      <DashboardToolbar
        activePanel={activePanel}
        isEditing={isEditing}
        onOpenPanel={(panel) => setActivePanel((current) => (current === panel ? null : panel))}
        onOpenQuickAdd={() => openQuickAdd()}
        onReset={resetDashboard}
        onToggleEdit={() => {
          setIsEditing((current) => !current);
          setSelectedWidgetId(null);
          setActivePanel(null);
        }}
      />

      <main
        className={`dashboard workspace-dashboard${gridMetrics.requiresScroll ? " is-scrollable" : ""}`}
        aria-label="보건실 업무 위젯 작업 공간"
        ref={ref}
      >
        <DesktopUpdateBanner
          state={updater.state}
          onDismiss={() => void updater.dismissAvailable()}
          onRetry={() => void updater.retry()}
          onUpdate={updater.requestInstall}
        />
        {visibleWidgets.length === 0 ? (
          <section className="workspace-empty">
            <Sparkles size={22} />
            <strong>표시 중인 위젯이 없습니다.</strong>
            <button type="button" onClick={() => setDashboardLayout(createDefaultDashboardLayout())}>기본 위젯 복원</button>
          </section>
        ) : gridWidth !== null ? (
          <GridLayout
            autoSize={false}
            className={`workspace-grid${isEditing ? " is-editing" : ""}`}
            dragConfig={{
              enabled: isEditing && !isCompact,
              handle: ".widget-frame__drag",
              cancel: ".react-resizable-handle, button, textarea, input, select, a",
            }}
            gridConfig={{ cols: 12, rowHeight: gridMetrics.rowHeight, margin: [gridMetrics.margin, gridMetrics.margin], containerPadding: null, maxRows: 40 }}
            layout={gridLayout}
            resizeConfig={{ enabled: isEditing && !isCompact, handles: ["se"] }}
            style={{ height: gridMetrics.contentHeight }}
            width={gridWidth}
            onLayoutChange={(nextLayout: Layout) => {
              if (isEditing && !isCompact) setDashboardLayout((current) => mergeGridLayout(current, nextLayout));
            }}
          >
            {visibleWidgets.map((widget) => {
              return (
                <div key={widget.id} data-widget-type={widget.type} data-grid-height={widget.h} data-grid-width={widget.w} tabIndex={-1}>
                  <WidgetFrame
                    isEditing={isEditing}
                    isSelected={selectedWidgetId === widget.id}
                    widget={widget}
                    onHide={() => {
                      setSelectedWidgetId(null);
                      setDashboardLayout((current) => hideWidget(current, widget.id));
                    }}
                    onSelect={() => setSelectedWidgetId(widget.id)}
                  />
                </div>
              );
            })}
          </GridLayout>
        ) : null}
      </main>

      {isEditing && activePanel === "library" && (
        <WidgetLibraryDrawer
          widgets={dashboardLayout.widgets}
          onClose={() => setActivePanel(null)}
          onRestore={(type: WidgetType) => setDashboardLayout((current) => restoreWidget(current, type))}
        />
      )}
      {isEditing && activePanel === "presets" && (
        <PresetSelector
          currentPresetId={dashboardLayout.presetId}
          onApply={(presetId) => setDashboardLayout((current) => applyPreset(current, presetId, window.confirm))}
          onClose={() => setActivePanel(null)}
        />
      )}
      {isEditing && activePanel === "appearance" && (
        <AppearancePanel
          appearance={dashboardLayout.appearance}
          onClose={() => setActivePanel(null)}
          onUpdate={updateAppearance}
        />
      )}
      {isEditing && activePanel === "dock" && <DockEditor dockLayout={dockLayout} onClose={() => setActivePanel(null)} onUpdate={setDockLayout} />}
      {toolbox.isToolboxOpen && (
        <ToolboxPanel
          isLoading={toolbox.isLauncherSettingsLoading}
          onClose={toolbox.closeToolbox}
          onExecute={runToolboxItem}
        />
      )}
      {isDesktopSettingsOpen && (
        <DesktopSettingsPanel
          initialSectionId={toolbox.settingsUrlActionId === null ? settingsSectionId : "connections"}
          initialUrlActionId={toolbox.settingsUrlActionId}
          onClose={navigation.closeSettings}
          onNotice={setNotice}
          onOpenOnboarding={onboarding.open}
          onOpenWorkspaceEditor={openWorkspaceEditor}
        />
      )}
      {updater.state.status === "confirming" && (
        <DesktopUpdateConfirmationDialog
          version={updater.state.metadata.version}
          onCancel={updater.cancelInstall}
          onConfirm={() => void updater.confirmInstall()}
        />
      )}
      {isQuickAddOpen && (
        <QuickAddPanel
          authStatus={auth.state.status}
          error={quickAddError}
          initialDate={quickAddInitial.initialDate}
          initialKind={quickAddInitial.initialKind}
          initialTaskTitle={quickAddInitial.initialTaskTitle}
          initialTaskArea={quickAddInitial.initialTaskArea}
          initialTaskCategory={quickAddInitial.initialTaskCategory}
          initialTaskPriority={quickAddInitial.initialTaskPriority}
          initialTaskDueDate={quickAddInitial.initialTaskDueDate}
          isSaving={isQuickAddSaving}
          onClose={() => {
            if (!isQuickAddSaving) setIsQuickAddOpen(false);
          }}
          onSubmit={submitQuickAdd}
        />
      )}
      {isInboxOpen && (
        <InboxPanel
          state={workspaceData.state}
          pendingTaskId={workspaceData.pendingTaskId}
          mutationError={workspaceData.taskActionStateError ?? workspaceData.taskMutationError}
          onClose={() => {
            setIsInboxOpen(false);
            void runDesktopAction("home");
          }}
          onOpen={(taskId, date) => openBogunonTarget({ kind: "task", id: taskId, date })}
          onSetActionState={workspaceData.setTaskActionState}
          onSetCompleted={workspaceData.setTaskCompleted}
        />
      )}
      {isCalculatorOpen && (
        <CalculatorPanel
          initialDate={formatLocalInputDate(now)}
          onClose={() => {
            setIsCalculatorOpen(false);
            void runDesktopAction("home");
          }}
          onNotice={setNotice}
        />
      )}
      {isPurchaseHelperOpen && (
        <PurchaseHelperPanel
          columns={purchaseColumns}
          candidates={purchaseCandidates}
          templates={purchaseImportTemplates}
          draft={purchaseDraft}
          draftTemplates={purchaseDraftTemplates}
          items={purchaseItems}
          settlement={purchaseSettlement}
          sources={purchaseSources}
          onAnalysis={appendPurchaseAnalysis}
          onChange={setPurchaseItems}
          onCandidatesChange={setPurchaseCandidates}
          onClose={() => {
            setIsPurchaseHelperOpen(false);
            void runDesktopAction("home");
          }}
          onColumnsChange={(columns) => {
            setPurchaseColumns(columns);
            settingsService.account.savePurchaseOutputColumns(columns);
          }}
          onDraftChange={setPurchaseDraft}
          onDraftTemplatesChange={(templates) => {
            setPurchaseDraftTemplates(templates);
            settingsService.account.savePurchaseDraftTemplates(templates);
          }}
          onSettlementChange={setPurchaseSettlement}
          onNotice={setNotice}
          onSourcesChange={setPurchaseSources}
          onTemplatesChange={(templates) => {
            setPurchaseImportTemplates(templates);
            settingsService.account.savePurchaseImportTemplates(templates);
          }}
        />
      )}
      {isOfficialDocumentOpen && (
        <OfficialDocumentPanel
          onClose={() => {
            setIsOfficialDocumentOpen(false);
            void runDesktopAction("home");
          }}
          onNotice={setNotice}
          onOpenAiSettings={() => openSettingsSection("ai")}
          onSendSummaryToQuickAdd={(draft) => openQuickAdd({
            initialKind: "task",
            initialTaskTitle: draft.title,
            initialTaskArea: draft.area,
            initialTaskCategory: draft.category,
            initialTaskPriority: draft.priority,
            initialTaskDueDate: draft.dueDate ?? "",
          })}
        />
      )}
      {isRecordHelperOpen && (
        <RecordHelperPanel
          onOpenAiSettings={() => openSettingsSection("ai")}
          onClose={() => {
            setIsRecordHelperOpen(false);
            void runDesktopAction("home");
          }}
        />
      )}
      {isQuickMemoOpen && (
        <QuickMemoPanel
          onClose={() => {
            setIsQuickMemoOpen(false);
            void runDesktopAction("home");
          }}
        />
      )}
      {isWorkFoldersOpen && (
        <WorkFoldersPanel
          favorites={workFolderFavorites}
          isLoading={isLoadingWorkFolders}
          onAdd={() => void addWorkFolderFavorite()}
          onClose={() => {
            setIsWorkFoldersOpen(false);
            void runDesktopAction("home");
          }}
          onOpen={(id) => {
            const favorite = workFolderFavorites.find((item) => item.id === id);
            if (favorite !== undefined) void openWorkFolderFavorite(favorite);
          }}
        />
      )}
      <CommandPalette
        authStatus={auth.state.status}
        favorites={workFolderFavorites}
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onCommand={runCommand}
        onFolder={openWorkFolderFavorite}
        onSearchResult={runBogunonSearchResult}
        onRequestOpen={openCommandPalette}
        userId={auth.state.user?.id ?? null}
      />

      {notice !== null && <div className="desktop-toast" role="status">{notice}</div>}

      <div className="dock-zone">
        <AppDock activeActionId={activeActionId} dockLayout={dockLayout} onAction={(actionId) => void runDesktopAction(actionId)} />
      </div>

    </div>
    </DesktopPanelProvider>
  );
}
