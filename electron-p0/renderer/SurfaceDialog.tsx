import {useEffect,useId,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
export function SurfaceDialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLElement>(null),close=useRef(onClose),id=useId();close.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,dialog=ref.current!;
  const siblings=[...document.body.children].filter(el=>el!==dialog.parentElement) as HTMLElement[];
  const states=siblings.map(el=>[el,el.inert??false] as const);siblings.forEach(el=>{el.inert=true});
  const focusables=()=>[...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')].filter(el=>!el.closest('[hidden],[inert]'));
  focusables()[0]?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();}
   if(event.key==='Tab'){const list=focusables(),first=list[0],last=list[list.length-1];if(!first){event.preventDefault();dialog.focus();}else if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus();}}
  };
  document.addEventListener('keydown',key,true);
  return()=>{document.removeEventListener('keydown',key,true);states.forEach(([el,value])=>{el.inert=value});if(previous?.isConnected)previous.focus();};
 },[]);
 return createPortal(<div className="rose-overlay"><section ref={ref} className="rose-dialog" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}><header className="rose-dialog-header"><h1 id={id}>{title}</h1><button type="button" aria-label={`${title} 닫기`} onClick={onClose}><X size={20}/></button></header><div className="rose-dialog-content">{children}</div></section></div>,document.body);
}
