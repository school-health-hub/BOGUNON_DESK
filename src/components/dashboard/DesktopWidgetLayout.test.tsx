// @vitest-environment jsdom
import {cleanup, render} from "@testing-library/react";
import type {ComponentProps, ReactNode} from "react";
import type {GridLayout as LibraryGrid} from "react-grid-layout";
import {afterEach, expect, it, vi} from "vitest";
import {createDefaultDashboardLayout} from "../../dashboard/layouts";
import {GridLayout as ElectronGrid} from "../../../electron-p0/renderer/adapters/GridLayout";
import {DesktopWidgetLayout} from "./DesktopWidgetLayout";

type GridProps = ComponentProps<typeof LibraryGrid>;
const recorded = vi.hoisted((): {props: GridProps | null} => ({props:null}));
vi.mock("react-grid-layout", () => ({GridLayout:(props: GridProps) => {recorded.props=props; return null;}}));
vi.mock("../../workspace-data/WorkspaceDataContext", () => ({useWorkspaceData:() => ({state:{status:"loading"}})}));
vi.mock("../../workspace-data/WorkspaceDataNotice", () => ({CompactWorkspaceNotices:({children}:{readonly children:ReactNode}) => <>{children}</>}));
vi.mock("./WidgetFrame", () => ({WidgetFrame:() => null}));
afterEach(() => {cleanup(); recorded.props=null;});
const current = (): GridProps => {
  if(recorded.props===null) throw new Error("Grid not rendered");
  return recorded.props;
};
const widgets=createDefaultDashboardLayout().widgets;
const item={i:"widget-clock",x:1,y:20,w:2,h:2};
const props={widgets,width:1200,compact:false,editing:true,selectedId:null,
  metrics:{contentHeight:1000,rowHeight:39,margin:12},onHide:vi.fn(),onSelect:vi.fn()};

it("does not persist automatic layouts after mount, visibility or width changes", () => {
  const save=vi.fn();
  const view=render(<DesktopWidgetLayout {...props} onLayoutChange={save}/>);
  current().onLayoutChange?.([{...item,y:0}]);
  view.rerender(<DesktopWidgetLayout {...props} width={900}
    widgets={widgets.map(w => ({...w,visible:false}))} onLayoutChange={save}/>);
  current().onLayoutChange?.([]);
  expect(save).not.toHaveBeenCalled();
});

it.each(["drag","resize"] as const)("saves exactly one explicit %s completion through shared and Electron grids", kind => {
  const save=vi.fn(), next=[{...item,x:3,y:22}];
  render(<DesktopWidgetLayout {...props} onLayoutChange={save}/>);
  const shared=current();
  const call=(grid:GridProps) => (kind==="drag"?grid.onDragStop:grid.onResizeStop)?.(next,item,next[0],null,new Event("mouseup"),null);
  call(shared); expect(save).toHaveBeenCalledExactlyOnceWith(next);
  save.mockClear();
  render(<ElectronGrid {...shared}/>);
  call(current()); expect(save).toHaveBeenCalledExactlyOnceWith(next);
});

it.each([{editing:false,compact:false},{editing:true,compact:true}])("does not save completions outside editable noncompact mode: %j", mode => {
  const save=vi.fn(), next=[{...item,y:0}];
  render(<DesktopWidgetLayout {...props} {...mode} onLayoutChange={save}/>);
  current().onDragStop?.(next,item,next[0],null,new Event("mouseup"),null);
  current().onResizeStop?.(next,item,next[0],null,new Event("mouseup"),null);
  expect(save).not.toHaveBeenCalled();
});

it("allows only the drag-handle button while keeping ordinary controls cancelled", () => {
  render(<DesktopWidgetLayout {...props} onLayoutChange={vi.fn()}/>);
  const cancel=current().dragConfig?.cancel;
  if(!cancel) throw new Error("Missing drag cancel selector");
  const handle=document.createElement("button"); handle.className="widget-frame__drag";
  expect(handle.matches(cancel)).toBe(false);
  for(const tag of ["button","textarea","input","select","a"]) expect(document.createElement(tag).matches(cancel)).toBe(true);
});
