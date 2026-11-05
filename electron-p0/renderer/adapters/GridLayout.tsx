import { GridLayout as ExistingGridLayout } from 'react-grid-layout';
import { useCallback,useLayoutEffect,useRef,useState,type ComponentProps } from 'react';
/** Electron layout only: measure the grid itself, excluding its parent's
 * padding and classic Windows scrollbar. Stored grid units are unchanged. */
export function GridLayout(props: ComponentProps<typeof ExistingGridLayout>) {
  const grid=useRef<HTMLDivElement|null>(null),[contentWidth,setContentWidth]=useState<number|null>(null);
  const attach=useCallback((element:HTMLDivElement|null)=>{
    grid.current=element;
    if(typeof props.innerRef==='function')props.innerRef(element);
    else if(props.innerRef)props.innerRef.current=element;
  },[props.innerRef]);
  useLayoutEffect(()=>{
    const element=grid.current;if(!element)return;
    const update=(width:number)=>{if(Number.isFinite(width)&&width>0)setContentWidth(width);};
    update(element.clientWidth);
    const observer=new ResizeObserver(([entry])=>{if(entry)update(entry.contentRect.width);});
    observer.observe(element);return()=>observer.disconnect();
  },[]);
  const cancel=props.dragConfig?.cancel?.replace(/\bbutton\b/g,'button:not(.widget-frame__drag)');
  return <ExistingGridLayout {...props} innerRef={attach} width={contentWidth??props.width} dragConfig={{...props.dragConfig,cancel}}/>;
}
