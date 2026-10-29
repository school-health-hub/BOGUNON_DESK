import { allowsFinderQaCommand } from './qaIpc';
import { FinderQaBlockedError } from './inertConnections';

export function allowsQaIpcRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const value = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url;
  const method = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET');
  let url: URL;
  try { url = new URL(value); } catch (error) { if (!(error instanceof TypeError)) throw error; return false; }
  const ipcOrigin = (url.protocol === 'http:' && url.hostname === 'ipc.localhost')
    || (url.protocol === 'ipc:' && url.hostname === 'localhost');
  return ipcOrigin && !url.port && !url.username && !url.password && !url.search && !url.hash
    && method.toUpperCase() === 'POST' && allowsFinderQaCommand(url.pathname.slice(1));
}

type BoundaryTarget = Pick<typeof window, 'fetch' | 'document' | 'Element' | 'HTMLFormElement' | 'open' | 'XMLHttpRequest' | 'WebSocket' | 'EventSource'>
  & { readonly navigator: Pick<Navigator, 'sendBeacon'> };

export function installFinderQaNetworkBoundary(target: BoundaryTarget = window): void {
  const localFetch = target.fetch?.bind(target);
  const guardedFetch: typeof fetch = async (input, init) => {
    if (!localFetch || !allowsQaIpcRequest(input, init)) throw new FinderQaBlockedError();
    return localFetch(input, init);
  };
  Object.defineProperty(target, 'fetch', { configurable: false, writable: false, value: guardedFetch });
  class BlockedTransport { constructor() { throw new FinderQaBlockedError(); } }
  for (const name of ['XMLHttpRequest', 'WebSocket', 'EventSource']) {
    Object.defineProperty(target, name, { configurable: false, writable: false, value: BlockedTransport });
  }
  Object.defineProperty(target.navigator, 'sendBeacon', { configurable: false, writable: false, value: () => false });
  Object.defineProperty(target, 'open', { configurable: false, writable: false, value: () => { throw new FinderQaBlockedError(); } });
  target.document.addEventListener('click', event => {
    const anchor = event.target instanceof target.Element ? event.target.closest('a[href]') : null;
    if (anchor !== null) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  target.document.addEventListener('submit', event => {
    if (event.target instanceof target.HTMLFormElement && event.target.hasAttribute('action')) event.preventDefault();
  }, true);
}
