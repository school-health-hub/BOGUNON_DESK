// QA frontend only: read DOM geometry and reproduce the previous width rule.
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const selectors = ['html', 'body', '.official-document-backdrop', '.official-document-panel', '.official-document-panel__body', '.official-document-preview', '.official-document-preview__toolbar'];
function metrics() {
  return selectors.map(selector => {
    const element = document.querySelector(selector);
    if (!element) return { selector, missing: true };
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { selector, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, excess: element.scrollWidth - element.clientWidth, left: rect.left, right: rect.right, width: rect.width, overflowX: style.overflowX, paddingLeft: style.paddingLeft, paddingRight: style.paddingRight, gridTemplateColumns: style.gridTemplateColumns };
  });
}
function setup() {
  const details = document.querySelector('.official-document-qa-banner details');
  if (!details || details.querySelector('[data-layout-probe]')) return false;
  const output = document.createElement('textarea');
  output.readOnly = true;
  output.setAttribute('aria-label', 'QA DOM 측정 결과');
  output.style.cssText = 'display:block;width:100%;min-width:0;height:60px;font-size:12px';
  function button(label, action) {
    const control = document.createElement('button');
    control.type = 'button'; control.textContent = label; control.dataset.layoutProbe = 'true';
    control.addEventListener('click', () => { void action().catch(error => { output.value = JSON.stringify({ error: error.message }); }); });
    details.append(control);
  }
  button('QA 화면 경계 측정', async () => {
    const original = document.createElement('style');
    original.textContent = '@media(max-width:900px){.official-document-backdrop{grid-template-columns:auto!important}.official-document-panel{width:calc(100vw - 20px)!important;min-width:auto!important}}';
    document.head.append(original);
    let before;
    try { await frame(); before = metrics(); } finally { original.remove(); }
    await frame();
    output.value = JSON.stringify({ viewport: { width: innerWidth, height: innerHeight }, baseline: 'reproduced bb5407a CSS width rule in this WebView2 DOM', before, after: metrics() });
  });
  const targets = [
    ['본문', '.official-document-paper section[aria-label="공문 본문"] pre'],
    ['붙임', '.official-document-paper__attachments pre'],
    ['메신저', '.official-document-appendix section:first-child pre'],
    ['체크리스트', '.official-document-appendix section:nth-child(2) pre'],
  ];
  for (const [label, selector] of targets) button(`QA ${label} 끝 보기`, async () => {
    const element = document.querySelector(selector);
    const scroller = document.querySelector('.official-document-panel__body');
    const toolbar = document.querySelector('.official-document-preview__toolbar');
    if (!element || !scroller || !element.firstChild) throw new Error(`QA target unavailable: ${label}`);
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let last; while (walker.nextNode()) if (walker.currentNode.textContent.trim()) last = walker.currentNode;
    if (!last) throw new Error('QA target has no text');
    const length = last.textContent.trimEnd().length;
    const range = document.createRange(); range.setStart(last, Math.max(0, length - 1)); range.setEnd(last, length);
    const viewport = scroller.getBoundingClientRect();
    scroller.scrollTop += range.getBoundingClientRect().bottom - (viewport.bottom - 24);
    await frame();
    const rect = range.getBoundingClientRect(); const bar = toolbar?.getBoundingClientRect();
    output.value = JSON.stringify({ target: label, lastText: last.textContent.trimEnd().slice(-100), visible: rect.top >= Math.max(viewport.top, bar?.bottom ?? 0) && rect.bottom <= viewport.bottom, top: rect.top, bottom: rect.bottom, viewportTop: viewport.top, viewportBottom: viewport.bottom, toolbarBottom: bar?.bottom, widths: metrics() });
  });
  details.append(output);
  return true;
}
let attempts = 0;
const timer = setInterval(() => { if (setup() || ++attempts >= 100) clearInterval(timer); }, 200);
