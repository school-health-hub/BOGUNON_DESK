import {readFileSync} from 'node:fs';
import postcss from 'postcss';
import {describe,expect,it} from 'vitest';

const stylesheet=readFileSync('electron-p0/renderer/design-polish.css','utf8');

describe('Soft Rose Cream Bento polish boundary',()=>{
  it('loads after the existing Workspace and Palette styles',()=>{
    const workspace=readFileSync('electron-p0/renderer/main.tsx','utf8');
    const palette=readFileSync('electron-p0/renderer/palette/main.tsx','utf8');
    expect(workspace.indexOf("import './design-polish.css';")).toBeGreaterThan(workspace.indexOf("import './design-07.css';"));
    expect(palette.indexOf("import '../design-polish.css';")).toBeGreaterThan(palette.indexOf("import './palette.css';"));
  });

  it('limits every rule to the approved candidate or Palette surface',()=>{
    let rules=0;
    postcss.parse(stylesheet).walkRules(rule=>{
      for(const selector of rule.selectors){
        expect(selector.trim()).toMatch(/^body\.(?:electron-soft-rose\.design-07-candidate|desktop-palette-root)\b/);
        rules++;
      }
    });
    expect(rules).toBeGreaterThan(20);
  });

  it('keeps the Palette canvas transparent while improving card legibility',()=>{
    expect(stylesheet).not.toMatch(/\.desktop-palette\s*\{[^}]*background:/);
    expect(stylesheet).toContain('data-widget-type="today-summary"');
    expect(stylesheet).toContain('rgb(255 253 249 / 96%)');
    expect(stylesheet).toContain('data-widget-type="quick-memo"');
    expect(stylesheet).toContain('overflow-y: auto');
  });
});
