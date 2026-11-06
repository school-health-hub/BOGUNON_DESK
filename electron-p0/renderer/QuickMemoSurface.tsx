import {useLayoutEffect,type ReactNode} from 'react';
import {SurfaceDialog} from './SurfaceDialog';
import './quick-memo-surface.css';

/** Keep the nonmodal memo above the actual Dock, including content zoom/wrapped Docks. */
export function QuickMemoSurface({onClose,children}:{onClose:()=>void;children:ReactNode}){
 useLayoutEffect(()=>{
  const overlay=document.querySelector<HTMLElement>('.quick-memo-surface');
  const dock=document.querySelector<HTMLElement>('.dock-zone');
  if(!overlay)return;
  const measure=()=>{
   const viewport=Math.min(window.innerHeight,window.visualViewport?.height??window.innerHeight);
   const bounds=dock?.getBoundingClientRect();
   const bottom=bounds&&bounds.height>0?Math.min(viewport,bounds.top-12):viewport;
   overlay.style.setProperty('--quick-memo-available-height',`${Math.max(0,Math.floor(bottom))}px`);
  };
  measure();
  const observer=new ResizeObserver(measure);
  if(dock)observer.observe(dock);
  observer.observe(document.documentElement);
  window.addEventListener('resize',measure);
  window.visualViewport?.addEventListener('resize',measure);
  return()=>{observer.disconnect();window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);};
 },[]);
 return <SurfaceDialog title="빠른 메모" modal={false} overlayClassName="quick-memo-surface" onClose={onClose}>{children}</SurfaceDialog>;
}
