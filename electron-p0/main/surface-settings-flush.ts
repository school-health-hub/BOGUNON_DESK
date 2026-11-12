export class SurfaceSettingsFlush {
  private sequence = 0;
  private pending = new Map<number, { actor: number; finish: (ok: boolean) => void }>();
  constructor(private timeoutMs = 10000) {}
  request(actor: number, send: (id: number) => void): Promise<void> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(false), this.timeoutMs);
      const finish = (ok: boolean) => {
        clearTimeout(timer);
        this.pending.delete(id);
        if (ok) resolve(); else reject(new Error('설정 저장 완료를 확인하지 못했습니다.'));
      };
      this.pending.set(id, { actor, finish });
      try { send(id); } catch { finish(false); }
    });
  }
  resolve(actor: number, id: unknown, ok: unknown): void {
    if (!Number.isSafeInteger(id) || typeof ok !== 'boolean') throw new Error('Invalid settings flush result');
    const request = this.pending.get(Number(id));
    if (!request || request.actor !== actor) throw new Error('Unexpected settings flush result');
    request.finish(ok);
  }
}
