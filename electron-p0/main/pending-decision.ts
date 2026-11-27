import { randomUUID } from 'node:crypto';

export class PendingDecision {
  private pending?: { id: string; resolve: (accepted: boolean) => void };

  get id(): string | undefined { return this.pending?.id; }

  request(notify: (id: string) => void): Promise<boolean> {
    if (this.pending) return Promise.resolve(false);
    return new Promise(resolve => {
      const id = randomUUID();
      this.pending = { id, resolve };
      try { notify(id); }
      catch { this.cancel(); }
    });
  }

  answer(id: unknown, accepted: unknown): boolean {
    const pending = this.pending;
    if (!pending || id !== pending.id || typeof accepted !== 'boolean') return false;
    this.pending = undefined;
    pending.resolve(accepted);
    return true;
  }

  cancel(): void {
    if (this.pending) this.answer(this.pending.id, false);
  }
}
