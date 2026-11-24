import {expect,it} from 'vitest';
import {createDefaultDashboardLayout} from '../../src/dashboard/layouts';
import {positionPaletteWidgetMenu,resizePaletteWidget} from '../renderer/palette/palette-ux-layout';

it('keeps the widget menu inside a small display work area',()=>{
  expect(positionPaletteWidgetMenu({x:760,y:620,width:180,height:70},{width:250,height:300},{width:980,height:700})).toEqual({left:498,top:388});
});

it('changes a selected widget size without changing other saved widget geometry',()=>{
  const layout=createDefaultDashboardLayout();
  const before=layout.widgets.find(widget=>widget.id==='widget-monthly-calendar');
  const next=resizePaletteWidget(layout,'widget-monthly-calendar',{w:4,h:5},8);
  const after=next.widgets.find(widget=>widget.id==='widget-monthly-calendar');
  expect(before?.w).toBe(8);
  expect(after).toMatchObject({w:4,h:5});
  expect(next.widgets.filter(widget=>widget.id!=='widget-monthly-calendar')).toEqual(layout.widgets.filter(widget=>widget.id!=='widget-monthly-calendar'));
});
