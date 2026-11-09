// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SchoolClientStore } from '../core/client-store.js';
import type { SchoolState } from '../core/types.js';
import { SchoolWorkspace } from '../ui/SchoolWorkspace.js';

async function renderMemberships(validUntil = '2026-11-08T15:00:00Z') {
 const state: SchoolState = {
  workspace: { phase: 'authenticated_unselected' },
  directory: [],
  self: { memberships: [], space_requests: [] },
  transfers: [],
  admin: {
   requests: [{
    id: 'request', member_code: 'pending', version: 1, state: 'pending',
    requested_role: 'HEALTH_ASSISTANT', requested_at: '2026-11-07T00:00:00Z',
   }],
   members: [{
    id: 'member', member_code: 'active', version: 2, status: 'active',
    role: 'HEALTH_ASSISTANT', approved_at: null, valid_until: validUntil,
   }],
  },
 };
 const command = vi.fn(async () => state);
 const store = new SchoolClientStore({ command });
 await store.command('state');
 render(<SchoolWorkspace store={store} client="electron" connected />);
 return command;
}

afterEach(cleanup);

it('approves the assistant through the last selected day in Korea', async () => {
 const command = await renderMemberships();
 const request = within(screen.getByRole('article', { name: '가입 신청 pending' }));

 fireEvent.change(request.getByLabelText('지원강사 유효기간'), { target: { value: '2026-12-31' } });
 fireEvent.click(request.getByRole('button', { name: '가입 승인' }));

 expect(command).toHaveBeenLastCalledWith('decide', expect.objectContaining({
  role: 'HEALTH_ASSISTANT', until: '2026-12-31T15:00:00.000Z',
 }));
});

it('opens an existing assistant term on its last valid date and renews through the chosen Korean day', async () => {
 const command = await renderMemberships();
 const member = within(screen.getByRole('article', { name: '구성원 active' }));
 const end = member.getByLabelText<HTMLInputElement>('새 유효기간');
 expect(end.value).toBe('2026-11-08');
 expect(member.getByText('2026. 11. 8.')).toBeTruthy();

 fireEvent.change(end, { target: { value: '2027-01-01' } });
 fireEvent.click(member.getByRole('button', { name: '유효기간 변경' }));
 fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '확인' }));

 expect(command).toHaveBeenLastCalledWith('expiry', {
  id: 'member', version: 2, until: '2027-01-01T15:00:00.000Z',
 });
});


it('does not extend a legacy expiry when the displayed date is unchanged', async () => {
 await renderMemberships('2026-11-08T23:59:59Z');
 const member = within(screen.getByRole('article', { name: '구성원 active' }));

 const end = member.getByLabelText<HTMLInputElement>('새 유효기간');

 expect(end.value).toBe('2026-11-09');
 expect(member.getByRole<HTMLButtonElement>('button', { name: '유효기간 변경' }).disabled).toBe(true);
});
