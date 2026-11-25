import {expect,it} from 'vitest';
import {getVisibleToolDefinitions} from '../renderer/toolbox/toolDefinitions';

it('keeps local inventory available without exposing the preview in the user toolbox',()=>{
 const visible=getVisibleToolDefinitions(false).map(tool=>tool.id);
 expect(visible).toContain('inventory-local');
 expect(visible).not.toContain('inventory-preview');
 expect(visible).not.toContain('inventory-qa');
 expect(getVisibleToolDefinitions(true).map(tool=>tool.id)).toContain('inventory-preview');
});
