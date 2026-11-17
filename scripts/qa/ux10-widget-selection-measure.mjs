export function measureWidgetLibrary() {
  const library = document.querySelector('.widget-library--cards');
  if (!library) throw Error('Widget selection library missing');
  const rect = element => { const r = element.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom }; };
  const cards = [...library.querySelectorAll('article')].map(element => {
    const title = element.querySelector('strong'),description = element.querySelector('p'),control = element.querySelector('[role="switch"]');
    const style = getComputedStyle(element), switchStyle = getComputedStyle(control);
    return { id:element.dataset.widgetType,rect:rect(element),title:title.textContent,titleFits:title.scrollWidth<=title.clientWidth+1,descriptionFits:description.scrollWidth<=description.clientWidth+1,description:description.textContent,checked:control.getAttribute('aria-checked'),background:style.backgroundColor,border:style.borderColor,switchColor:switchStyle.color,control:rect(control),focus:control.matches(':focus-visible'),outline:switchStyle.outline };
  });
  const overlaps = [];
  for (let i=0;i<cards.length;i++) for(let j=i+1;j<cards.length;j++) {
    const a=cards[i].rect,b=cards[j].rect;
    if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1) overlaps.push([cards[i].id,cards[j].id]);
  }
  return { viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},library:rect(library),pageOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,libraryOverflow:library.scrollWidth-library.clientWidth,groups:[...library.querySelectorAll('.widget-library__list')].map(element=>({columns:getComputedStyle(element).gridTemplateColumns.split(' ').length,width:element.clientWidth})),cards,overlaps,fontLoaded:document.fonts.check('14px Pretendard'),scrollOwners:[...document.querySelectorAll('.workspace-editor-panel__body,.rose-dialog-content')].filter(element=>element.contains(library)||library.contains(element)).map(element=>({className:element.className,height:element.clientHeight,scrollHeight:element.scrollHeight,scrollTop:element.scrollTop,overflowY:getComputedStyle(element).overflowY})) };
}
