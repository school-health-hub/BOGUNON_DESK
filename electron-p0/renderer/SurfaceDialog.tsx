import {useEffect,useId,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
export function SurfaceDialog({title,onClose,children,modal=true,shouldRestoreFocus=()=>true}:{title:string;onClose:()=>void;children:ReactNode;modal?:boolean;shouldRestoreFocus?:()=>boolean}){
 const ref=useRef<HTMLElement>(null),close=useRef(onClose),restore=useRef(shouldRestoreFocus),id=useId();close.current=onClose;restore.current=shouldRestoreFocus;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,dialog=ref.current!;
  const siblings=modal?[...document.body.children].filter(el=>el!==dialog.parentElement) as HTMLElement[]:[];
  const states=siblings.map(el=>[el,el.inert??false] as const);siblings.forEach(el=>{el.inert=true});
  const visible=(el:HTMLElement)=>{for(let node:HTMLElement|null=el;node;node=node.parentElement){if(node.hidden||node.inert||getComputedStyle(node).display==='none'||getComputedStyle(node).visibility==='hidden')return false;}return true;};
  const focusables=()=>[...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')].filter(visible);
  focusables()[0]?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&(modal||dialog.contains(document.activeElement))){event.preventDefault();event.stopPropagation();close.current();}
   if(modal&&event.key==='Tab'){const list=focusables(),first=list[0],last=list[list.length-1];if(!first){event.preventDefault();dialog.focus();}else if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus();}}
  };
  document.addEventListener('keydown',key,true);
  return()=>{document.removeEventListener('keydown',key,true);states.forEach(([el,value])=>{el.inert=value});if(restore.current()&&previous?.isConnected&&visible(previous)&&(modal||document.activeElement===document.body||dialog.contains(document.activeElement)))previous.focus();};
 },[modal]);
 return createPortal(<div className={`rose-overlay${modal?'':' is-nonmodal'}`}><section ref={ref} className="rose-dialog" role="dialog" aria-modal={modal?true:undefined} aria-labelledby={id} tabIndex={-1}><header className="rose-dialog-header"><h1 id={id}>{title}</h1><button type="button" aria-label={`${title} 닫기`} onClick={onClose}><X size={20}/></button></header><div className="rose-dialog-content">{children}</div></section></div>,document.body);
}
