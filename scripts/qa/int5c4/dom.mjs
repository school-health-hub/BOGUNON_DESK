export function inspect() {
  const rect = e => { const r = e.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height }; };
  const rgb = s => s.match(/[\d.]+/g)?.map(Number) ?? [];
  const luminance = c => c.slice(0,3).map(v => { v/=255; return v<=.04045?v/12.92:((v+.055)/1.055)**2.4; }).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
  const styles = e => {
    const s=getComputedStyle(e), a=rgb(s.color), b=rgb(s.backgroundColor);
    const opaque=(a[3]??1)===1&&(b[3]??1)===1&&s.backgroundImage==='none'&&s.opacity==='1';
    const x=luminance(a),y=luminance(b);
    return { text:e.textContent.trim(),rect:rect(e),foreground:s.color,background:s.backgroundColor,outline:s.outline,focusVisible:e.matches(':focus-visible'),active:e===document.activeElement,contrast:opaque?(Math.max(x,y)+.05)/(Math.min(x,y)+.05):null,method:opaque?'computed opaque CSS':'NOT MEASURED: nonopaque/gradient',font:s.font,fontLoaded:document.fonts.check(s.font) };
  };
  const helpers=[...document.querySelectorAll('.official-document-prompt-help')].map(e=>{
    const lines=[];
    for(const n of e.childNodes) if(n.nodeType===Node.TEXT_NODE) for(let i=0;i<n.length;i++) { const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+1);const b=r.getBoundingClientRect();let line=lines.find(l=>Math.abs(l.y-b.y)<2);if(!line){line={y:b.y,text:''};lines.push(line);}line.text+=n.textContent[i]; }
    return {text:e.textContent,rect:rect(e),lines,orphanEnding:lines.some(l=>/^(니다\.|다\.|요\.)$/.test(l.text.trim())),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};
  });
  const select=document.querySelector('.purchase-settlement-table select');
  let purchase=null;
  if(select){const s=getComputedStyle(select),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=s.font;const text=select.selectedOptions[0].text;const available=select.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight);purchase={value:select.value,text,rect:rect(select),textWidth:ctx.measureText(text).width,availableBeforeNativeArrow:available,nativeArrowBudget:20,fitEstimate:ctx.measureText(text).width+20<=available,columns:[...document.querySelectorAll('.purchase-settlement-table th')].map(rect),tableScroll:[...document.querySelectorAll('.purchase-settlement-table-wrap')].map(e=>({clientWidth:e.clientWidth,scrollWidth:e.scrollWidth}))};}
  return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},page:{clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth},finance:[...document.querySelectorAll('.finance-area-tabs button,.finance-phase2-tabs button')].map(styles),helpers,purchase,bodyText:document.body.innerText};
}
