import {expect,it} from 'vitest';
import {createDefaultDashboardLayout} from '../../src/dashboard/layouts';
import {parseDashboardLayoutValue} from '../../src/dashboard/storage';
import {widgetDefinitions} from '../../src/dashboard/widgetRegistry';
import {moveWidgetOwnership} from '../main/desktop-surface-domain';
import type {DesktopSurfaceDocument} from '../desktop-surface-protocol';

it('offers a hidden newsletter shortcut without resetting an existing dashboard layout',()=>{
  const old=createDefaultDashboardLayout();
  const legacy={...old,widgets:old.widgets.filter(widget=>widget.id!=='widget-newsletter-shortcut')};
  const migrated=parseDashboardLayoutValue(legacy);
  expect(widgetDefinitions.some(widget=>widget.type==='newsletter-shortcut')).toBe(true);
  expect(migrated?.widgets.find(widget=>widget.id==='widget-newsletter-shortcut')).toMatchObject({visible:false});
  expect(migrated?.widgets.filter(widget=>widget.id!=='widget-newsletter-shortcut')).toEqual(legacy.widgets);
});

it('claims a new shortcut in a legacy monitor profile without touching another monitor',()=>{
  const layout=createDefaultDashboardLayout();
  const legacy={...layout,widgets:layout.widgets.filter(widget=>widget.type!=='newsletter-shortcut')};
  const primaryLayout={...legacy,widgets:legacy.widgets.map(widget=>({...widget,visible:widget.id==='widget-clock'}))};
  const monitor={fingerprint:'synthetic',label:'QA display',lastDisplayId:1,workArea:{x:0,y:0,width:1920,height:1080},scaleFactor:1};
  const document:DesktopSurfaceDocument={version:2,mode:'palette',dockProfileKey:'primary',profiles:{primary:{visible:true,layout:primaryLayout,ownedWidgetIds:['widget-clock'],monitor,dormant:false,updatedAt:'before'},secondary:{visible:true,layout:legacy,ownedWidgetIds:[],monitor:{...monitor,lastDisplayId:2},dormant:false,updatedAt:'before'}}};
  const moved=moveWidgetOwnership(document,'widget-newsletter-shortcut','primary','after');
  expect((moved.profiles.primary.layout as typeof layout).widgets.find(widget=>widget.id==='widget-newsletter-shortcut')).toMatchObject({visible:true,w:3,h:2});
  expect(moved.profiles.secondary).toEqual(document.profiles.secondary);
  expect((moved.profiles.primary.layout as typeof layout).widgets.filter(widget=>widget.id!=='widget-newsletter-shortcut')).toEqual(legacy.widgets.map(widget=>({...widget,visible:widget.id==='widget-clock'})));
});
