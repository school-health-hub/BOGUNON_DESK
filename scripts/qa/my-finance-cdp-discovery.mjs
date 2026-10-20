// Only loopback discovery metadata is reported: no page titles, URLs or contents.
export async function discoverPage(port, { fetcher = fetch, timeoutMs = 30_000, intervalMs = 500, now = Date.now, delay = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  if (!/^\d+$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535) throw Error('Invalid local debugging port');
  const started = now();
  const evidence = { port: Number(port), attempts: 0, elapsedMs: 0, listStatus: null, versionStatus: null, targetTypes: [], lastError: null, browserEndpoint: false };
  let page;
  while (now() - started < timeoutMs) {
    evidence.attempts++;
    try {
      const response = await fetcher(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1500) });
      evidence.listStatus = response.status;
      if (response.ok) {
        const targets = await response.json();
        if (!Array.isArray(targets)) throw Error('INVALID_TARGET_LIST');
        evidence.targetTypes = targets.map(p => String(p.type).replace(/[^a-z_-]/gi, '').slice(0, 32));
        page = targets.find(p => p.type === 'page' && typeof p.webSocketDebuggerUrl === 'string');
        evidence.lastError = null;
        if (page) break;
      }
    } catch (error) {
      evidence.lastError = error.cause?.code ?? (error.message === 'INVALID_TARGET_LIST' ? error.message : error.name);
    }
    try {
      const response = await fetcher(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) });
      evidence.versionStatus = response.status;
      if (response.ok) evidence.browserEndpoint = typeof (await response.json()).webSocketDebuggerUrl === 'string';
    } catch { /* The list error is the primary diagnosis. */ }
    await delay(intervalMs);
  }
  evidence.elapsedMs = now() - started;
  return { page, evidence };
}
