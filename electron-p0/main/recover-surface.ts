import {fitBounds,type Bounds} from './desktop.js';
interface Surface {getNormalBounds():Bounds;setMinimumSize(width:number,height:number):void;setBounds(bounds:Bounds):void;}
export function recoverSurface(surface:Surface,areas:Bounds[],minimum:readonly [number,number]):void{
 if(!areas.length)return;
 const bounds=fitBounds(surface.getNormalBounds(),areas);
 surface.setMinimumSize(Math.min(minimum[0],bounds.width),Math.min(minimum[1],bounds.height));
 surface.setBounds(bounds);
}
