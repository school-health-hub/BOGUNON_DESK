// Serialized into the real browser by Playwright; no product imports or data mocks.
export function measure() {
  const rect = element => element?.getBoundingClientRect().toJSON() ?? null;
  const style = element => {
    const computed = getComputedStyle(element);
    return Object.fromEntries(['color', 'backgroundColor', 'backgroundImage', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'wordBreak', 'overflowWrap', 'overflowX', 'overflowY', 'opacity', 'outlineColor', 'outlineWidth', 'outlineStyle', 'boxShadow', 'borderColor'].map(key => [key, computed[key]]));
  };
  const describe = element => ({ tag: element.tagName, className: element.className?.baseVal ?? element.className, text: element.textContent.trim().slice(0, 180), rect: rect(element), clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, style: style(element) });
  const visible = element => { const r = element.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(element).visibility !== 'hidden'; };
  const main = document.querySelector('main');
  const clock = [...document.querySelectorAll('.date-card,.date-card__time,.date-card__date')].map(describe);
  const buttons = [...document.querySelectorAll('.quick-launcher button,.memo-panel button,.dock button')].map(element => {
    const r = element.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { ...describe(element), disabled: element.disabled, visible: visible(element), unobscured: hit === element || element.contains(hit) };
  });
  const words = [...document.querySelectorAll('.summary-card h1,.summary-card span')].map(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const characters = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      for (let i = 0; i < node.length; i++) {
        if (!node.textContent[i].trim()) continue;
        const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + 1);
        characters.push({ character: node.textContent[i], rect: range.getBoundingClientRect().toJSON() });
      }
    }
    return { text: element.textContent, characters };
  });
  return {
    actualDom: true, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    pageWidth: document.documentElement.scrollWidth, main: main ? { ...describe(main), scrollTop: main.scrollTop } : null,
    dock: rect(document.querySelector('.dock')), clock, words, buttons,
    surfaces: [...document.querySelectorAll('.workspace-shell,.workspace-dashboard,.dock,.summary-card,.date-card,.calendar-panel,.quick-launcher,.memo-panel,.desktop-settings,.toolbox-panel,.official-document-panel')].map(describe),
    dialogs: [...document.querySelectorAll('[role="dialog"]')].filter(visible).map(describe),
    dialogControls: [...document.querySelectorAll('[role="dialog"] input,[role="dialog"] textarea,[role="dialog"] button,[role="dialog"] select')].filter(visible).map(element => ({ ...describe(element), value: element.value ?? null, disabled: element.disabled, accessibleName: element.getAttribute('aria-label') })),
    widgets: [...document.querySelectorAll('[data-widget-type]')].map(element => ({ type: element.dataset.widgetType, ...describe(element) })),
    scrollContainers: [...document.querySelectorAll('main *')].filter(element => visible(element) && /auto|scroll/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1).map(describe),
    horizontalOverflow: [...document.querySelectorAll('main *')].filter(element => visible(element) && element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1).map(describe),
    active: document.activeElement ? { ...describe(document.activeElement), focusVisible: document.activeElement.matches(':focus-visible') } : null,
    fontLoaded: document.fonts.check('13px Pretendard'), nativeDpi: 'NOT RUN',
  };
}

export function textSamples() {
  const samples = [];
  for (const element of document.querySelectorAll('.workspace-dashboard *,.dock *,.desktop-settings *,.toolbox-panel *,.official-document-panel *')) {
    const computed = getComputedStyle(element), bounds = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height || computed.visibility === 'hidden') continue;
    let opacity = 1, unsupported = false;
    for (let parent = element; parent; parent = parent.parentElement) {
      const s = getComputedStyle(parent); opacity *= Number(s.opacity);
      unsupported ||= s.mixBlendMode !== 'normal' || s.filter !== 'none' || s.backdropFilter !== 'none';
    }
    if (opacity === 0) continue;
    const rectangles = [];
    for (const node of element.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      rectangles.push(...[...range.getClientRects()].map(r => r.toJSON()));
    }
    if (!rectangles.length) continue;
    const color = computed.color.match(/^rgba?\(([^)]+)\)$/);
    const rgba = color ? color[1].split(/[,\s/]+/).filter(Boolean).map(Number) : null;
    const size = parseFloat(computed.fontSize), weight = Number(computed.fontWeight);
    samples.push({ text: [...element.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim(), color: computed.color, rgba, opacity, unsupported, disabled: Boolean(element.closest(':disabled,[aria-disabled="true"]')), fontSize: size, fontWeight: weight, threshold: size >= 24 || (size >= 18.6667 && weight >= 700) ? 3 : 4.5, rectangles });
  }
  return samples;
}
