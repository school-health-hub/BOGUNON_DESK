import { expect, it, vi } from 'vitest';
import { notifySchoolChange } from '../main/school-settings-notification';
it('invalidates cached views only after a successful guarded operation', async () => {
  const notify = vi.fn();
  const denied = notifySchoolChange(async () => ({ ok: false as const }), notify);
  await denied(); expect(notify).not.toHaveBeenCalled();
  const saved = notifySchoolChange(async () => ({ ok: true as const, data: 7 }), notify);
  expect(await saved()).toEqual({ ok: true, data: 7 }); expect(notify).toHaveBeenCalledOnce();
});
