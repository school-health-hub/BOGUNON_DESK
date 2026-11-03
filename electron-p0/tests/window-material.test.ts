import {expect, it} from 'vitest';
import {resolveWindowMaterial} from '../main/window-material';

const supported = {platform:'win32', release:'10.0.22621', requested:true, reducedTransparency:false, highContrast:false} as const;

it('requests native acrylic only for explicit opt-in on supported Windows', () => {
 expect(resolveWindowMaterial(supported)).toEqual({windowMaterial:'acrylic',windowMaterialRequested:true,desktopAttachment:false});
 for (const release of ['10.0.22000','10.0.19045','unknown','10.0.22621-preview','10.0.99999999999999999']) {
  expect(resolveWindowMaterial({...supported,release}).windowMaterial).toBe('none');
 }
 expect(resolveWindowMaterial({...supported,release:'10.0.26100'}).windowMaterial).toBe('acrylic');
 expect(resolveWindowMaterial({...supported,platform:'linux'}).windowMaterial).toBe('none');
 expect(resolveWindowMaterial({...supported,platform:'darwin'}).windowMaterial).toBe('none');
});

it('keeps ordinary windows opaque by default and honors reduced effects/high contrast', () => {
 expect(resolveWindowMaterial({...supported,requested:false})).toEqual({windowMaterial:'none',windowMaterialRequested:false,desktopAttachment:false});
 expect(resolveWindowMaterial({...supported,reducedTransparency:true}).windowMaterial).toBe('none');
 expect(resolveWindowMaterial({...supported,highContrast:true}).windowMaterial).toBe('none');
});

it('does not represent native material as desktop attachment', () => {
 for(const requested of [false,true])expect(resolveWindowMaterial({...supported,requested}).desktopAttachment).toBe(false);
});
