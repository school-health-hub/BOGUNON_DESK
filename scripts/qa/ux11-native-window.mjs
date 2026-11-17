// QA controller only: read actual Electron/Windows display data; never simulate DPI.
export function measureNativeWindow({screen,BrowserWindow,app}) {
  const window=BrowserWindow.getAllWindows()[0];
  if(!window)throw Error('QA application window missing');
  const bounds=window.getBounds(),display=screen.getDisplayMatching(bounds);
  return {displayId:display.id,scaleFactor:display.scaleFactor,effectiveDpi:96*display.scaleFactor,
    displayDip:display.bounds,workAreaDip:display.workArea,
    displayPhysical:screen.dipToScreenRect(window,display.bounds),
    workAreaPhysical:screen.dipToScreenRect(window,display.workArea),
    windowDip:bounds,contentDip:window.getContentBounds(),
    windowPhysical:screen.dipToScreenRect(window,bounds),
    contentPhysical:screen.dipToScreenRect(window,window.getContentBounds()),
    zoom:window.webContents.getZoomFactor(),visible:window.isVisible(),
    forcedDeviceScale:app.commandLine.hasSwitch('force-device-scale-factor')};
}
export function measureWidgetPolish(){
  const library=document.querySelector('.widget-library--cards');
  if(!library)throw Error('Widget library missing');
  const dock=document.querySelector('.dock-zone'),dockBounds=dock?.getBoundingClientRect();
  return {dock:dockBounds?{x:dockBounds.x,y:dockBounds.y,width:dockBounds.width,height:dockBounds.height}:null,
    captions:[...library.querySelectorAll('.widget-library__state')].map(e=>e.textContent),
    groups:[...library.querySelectorAll('section')].map(e=>({marginTop:getComputedStyle(e).marginTop,headingMarginBottom:getComputedStyle(e.querySelector('h2')).marginBottom})),
    cards:[...library.querySelectorAll('article')].map(card=>{const style=getComputedStyle(card),copy=card.querySelector('.widget-library__copy'),control=card.querySelector('[role=switch]'),r=card.getBoundingClientRect(),c=copy.getBoundingClientRect(),s=control.getBoundingClientRect();return {id:card.dataset.widgetType,height:r.height,minHeight:style.minHeight,padding:style.padding,copyContained:c.y>=r.y&&c.bottom<=r.bottom,switchContained:s.y>=r.y&&s.bottom<=r.bottom,target:{width:s.width,height:s.height},accessibleName:control.getAttribute('aria-label'),descriptionId:control.getAttribute('aria-describedby'),visibleSwitchText:control.textContent.trim()};})};
}