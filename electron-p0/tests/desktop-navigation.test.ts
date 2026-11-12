import { expect, it, vi } from 'vitest';
import { DesktopNavigationQueue, parseDesktopEntry, parseSettingsSection } from '../main/desktop-navigation';
import type { DesktopEntry } from '../desktop-surface-protocol';

it('preserves the first pending destination and delivers it once when the renderer becomes ready',()=>{
  const show=vi.fn(),send=vi.fn<(entry:DesktopEntry)=>void>();
  const queue=new DesktopNavigationQueue(show,send);
  queue.request({kind:'module',moduleId:'official-document'});
  queue.request({kind:'module',moduleId:'finance'});
  expect(send).not.toHaveBeenCalled();
  queue.ready();
  queue.ready();
  expect(send.mock.calls).toEqual([[{kind:'module',moduleId:'official-document'}]]);
});

it('reuses the supplied window show callback for repeated open requests without a destination',()=>{
  const show=vi.fn(),send=vi.fn();
  const queue=new DesktopNavigationQueue(show,send);
  queue.request();
  queue.request();
  queue.ready();
  expect(show).toHaveBeenCalledTimes(2);
  expect(send).not.toHaveBeenCalled();
});

it('delivers new requests immediately after ready and discards pending entries on reset',()=>{
  const send=vi.fn<(entry:DesktopEntry)=>void>();
  const queue=new DesktopNavigationQueue(()=>undefined,send);
  queue.request({kind:'action',actionId:'quick-memo'});
  queue.reset();
  queue.ready();
  queue.request({kind:'module',moduleId:'newsletter'});
  expect(send.mock.calls).toEqual([[{kind:'module',moduleId:'newsletter'}]]);
});

it.each([
  null, 'finance', {}, {kind:'module'}, {kind:'action'},
  {kind:'module',moduleId:'unknown'}, {kind:'module',moduleId:'finance',url:'file:///private'},
  {kind:'action',actionId:'unknown'}, {kind:'action',actionId:'settings',moduleId:'finance'},
  {kind:'action',actionId:1}, {kind:'module',moduleId:['finance']},
])('rejects an invalid Desktop payload: %j',value=>{
  expect(()=>parseDesktopEntry(value)).toThrow('Invalid Desktop destination');
});

it('accepts registered module and action destinations and rejects unknown Settings sections',()=>{
  expect(parseDesktopEntry({kind:'module',moduleId:'personal-inventory'})).toEqual({kind:'module',moduleId:'personal-inventory'});
  expect(parseDesktopEntry({kind:'action',actionId:'settings'})).toEqual({kind:'action',actionId:'settings'});
  expect(parseSettingsSection('appearance')).toBe('appearance');
  expect(()=>parseSettingsSection('finance')).toThrow('Invalid Settings section');
});
