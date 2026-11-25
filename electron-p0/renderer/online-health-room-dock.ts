import type {DockLayout} from '../../src/dock/types';
export function onlineHealthRoomDock(layout:DockLayout,enabled:boolean):DockLayout{return {...layout,items:layout.items.map(item=>item.id==='online-health-room'?{...item,visible:enabled}:item)};}
