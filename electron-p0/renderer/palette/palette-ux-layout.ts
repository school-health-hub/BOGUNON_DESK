import {widgetRegistry} from '../../../src/dashboard/widgetRegistry';
import type {DashboardLayout,WidgetSize} from '../../../src/dashboard/types';

type Rect=Readonly<{x:number;y:number;width:number;height:number}>;
type Viewport=Readonly<{width:number;height:number}>;

export function positionPaletteWidgetMenu(card:Rect,menu:Readonly<{width:number;height:number}>,viewport:Viewport):Readonly<{left:number;top:number}>{
  const margin=12;
  const right=card.x+card.width+margin;
  const left=right+menu.width+margin<=viewport.width?right:card.x-menu.width-margin;
  return {
    left:Math.max(margin,Math.min(left,viewport.width-menu.width-margin)),
    top:Math.max(margin,Math.min(card.y,viewport.height-menu.height-margin)),
  };
}

export function resizePaletteWidget(layout:DashboardLayout,widgetId:string,size:WidgetSize,maxRows:number):DashboardLayout{
  let changed=false;
  const widgets=layout.widgets.map(widget=>{
    if(widget.id!==widgetId)return widget;
    const definition=widgetRegistry[widget.type];
    const w=Math.max(definition.minW,Math.min(definition.maxW??12,size.w));
    const h=Math.max(definition.minH,Math.min(definition.maxH??maxRows,size.h,maxRows));
    const x=Math.max(0,Math.min(12-w,widget.x));
    const y=Math.max(0,Math.min(maxRows-h,widget.y));
    changed=w!==widget.w||h!==widget.h||x!==widget.x||y!==widget.y;
    return changed?{...widget,x,y,w,h}:widget;
  });
  return changed?{...layout,widgets}:layout;
}
