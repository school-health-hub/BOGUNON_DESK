import { describe, expect, it, vi } from 'vitest';
import { PendingDecision } from '../main/pending-decision';

describe('PendingDecision', () => {
  it('accepts one response for the current ID and rejects stale or malformed replies', async () => {
    const decision = new PendingDecision();
    const send = vi.fn();
    const result = decision.request(send);
    const id = decision.id;
    expect(send).toHaveBeenCalledOnce();
    expect(decision.answer('forged', true)).toBe(false);
    expect(decision.answer(id, 'true')).toBe(false);
    expect(decision.answer(id, true)).toBe(true);
    expect(decision.answer(id, true)).toBe(false);
    await expect(result).resolves.toBe(true);
  });

  it('does not reuse an in-flight decision for a concurrent request and cancels on owner close', async () => {
    const decision = new PendingDecision();
    const send = vi.fn();
    const first = decision.request(send);
    await expect(decision.request(send)).resolves.toBe(false);
    expect(send).toHaveBeenCalledOnce();
    decision.cancel();
    await expect(first).resolves.toBe(false);
    expect(decision.id).toBeUndefined();
  });

  it('fails closed if the owner cannot receive the request', async () => {
    const decision = new PendingDecision();
    await expect(decision.request(() => { throw new Error('window closed'); })).resolves.toBe(false);
    expect(decision.id).toBeUndefined();
  });
});
