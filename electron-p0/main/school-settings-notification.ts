// Notify only after the existing sender-checked operation commits successfully.
export function notifySchoolChange<Args extends unknown[], Result extends { ok: boolean }>(handler: (...args: Args) => Promise<Result>, notify: () => void): (...args: Args) => Promise<Result> {
  return async (...args) => { const result = await handler(...args); if (result.ok) notify(); return result; };
}
