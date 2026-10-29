// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { installFinderQaNetworkBoundary } from './networkBoundary';
import { FinderQaBlockedError } from './inertConnections';

describe('installed offline transport boundary', () => {
  it('blocks external browser transport before any downstream call', async () => {
    // Given a transport spy and an installed one-way QA guard in this isolated test environment.
    const localFetch: typeof fetch = async () => new Response('{}');
    const fetchSpy = vi.fn(localFetch);
    const sendBeacon: Navigator['sendBeacon'] = () => true;
    const browser = { fetch: fetchSpy, document: document.implementation.createHTMLDocument('QA guard test'),
      navigator: { sendBeacon }, open: window.open, XMLHttpRequest: window.XMLHttpRequest,
      WebSocket: window.WebSocket, EventSource: window.EventSource, Element: window.Element, HTMLFormElement: window.HTMLFormElement };
    installFinderQaNetworkBoundary(browser);
    // When browser transports attempt to reach an external destination.
    await expect(browser.fetch('https://api.openai.com/v1/responses', { method: 'POST' })).rejects.toBeInstanceOf(FinderQaBlockedError);
    expect(() => new browser.XMLHttpRequest()).toThrow(FinderQaBlockedError);
    expect(() => new browser.WebSocket('wss://example.test')).toThrow(FinderQaBlockedError);
    expect(() => new browser.EventSource('https://example.test')).toThrow(FinderQaBlockedError);
    expect(browser.navigator.sendBeacon('https://example.test')).toBe(false);
    expect(() => browser.open('https://example.test')).toThrow(FinderQaBlockedError);
    // Then no external transport is dispatched and external anchors are cancelled.
    expect(fetchSpy).not.toHaveBeenCalled();
    const anchor = browser.document.createElement('a'); anchor.href = 'https://example.test'; browser.document.body.append(anchor);
    expect(anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).toBe(false);
  });
});
