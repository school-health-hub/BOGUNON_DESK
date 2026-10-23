import { describe, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => vi.fn(async () => ({ status: 'connected', email: null, displayName: null, planUsageEnabled: true, clientRegistrationExists: true, showPlanUsageNotice: false, notice: null })));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: native }));
import { createDisabledApiConnection, createReadOnlyConnection, READ_ONLY_GUIDANCE } from './services';
describe('isolated QA frontend service boundary', () => {
 it('reads native state but never invokes credential mutations', async () => {
  const service = createReadOnlyConnection(); await service.refresh(); expect(native).toHaveBeenCalledWith('chatgpt_get_connection_state'); native.mockClear();
  await service.startSignIn(); await service.disconnect(); expect(native).not.toHaveBeenCalled(); expect(service.getState().error).toBe(READ_ONLY_GUIDANCE); expect(service.getState().status).toBe('connected');
 });
 it('disables API key providers without native or network calls', async () => {
  native.mockClear(); const service = createDisabledApiConnection(); await service.connect({ provider: 'openai', model: 'none', apiKey: 'synthetic-test-only' }); await service.validate();
  expect(service.getState().status).toBe('disconnected'); await expect(service.generateText('synthetic')).rejects.toThrow('API Key'); expect(native).not.toHaveBeenCalled();
 });
});

it('matches the exact approved public prompt fingerprint used by the native QA guard', async () => {
 const { buildVideoSearchPrompt } = await import('../education-video/aiVideo');
 const { APPROVED_SEARCH_CONDITIONS, APPROVED_SEARCH_PROMPT_SHA256 } = await import('./services');
 const bytes = new TextEncoder().encode(buildVideoSearchPrompt(APPROVED_SEARCH_CONDITIONS));
 const digest = await crypto.subtle.digest('SHA-256', bytes);
 expect(bytes.length).toBe(964);
 expect(Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')).toBe(APPROVED_SEARCH_PROMPT_SHA256);
});
it('allows only the unused fourth slot with three preserved attempts and the SSE diagnostics contract', async () => {
 const services = await import('./services');
 const stamp = { sourceSha: 'c'.repeat(40), baseSha: '419e31e2c9e32c6a36dd6c4982572436fb96669b' };
 const metadata = { ...stamp, identifier: 'kr.sungandi.schoolhealthdesk.finderliveqa', readOnlyAuth: true, libraryIsolated: true, externalDispatchEnabled: false, activeApprovedSlot: 4, searchSlotOneUsed: true, searchSlotTwoUsed: true, searchSlotThreeUsed: true, searchSlotFourUsed: false, searchToolChoice: 'auto', sseDiagnosticsVersion: 3 };
 expect(services.verifyFourthSearchMetadata(metadata, stamp)).toBe(true);
 for (const invalid of [null, {}, {...metadata, activeApprovedSlot:2}, {...metadata, searchSlotTwoUsed:false}, {...metadata, searchSlotThreeUsed:false}, {...metadata, searchSlotFourUsed:true}, {...metadata, searchToolChoice:'required'}, {...metadata, sseDiagnosticsVersion:2}, {...metadata, sourceSha:'wrong'}, {...metadata, baseSha:'wrong'}, {...metadata, readOnlyAuth:false}, {...metadata, libraryIsolated:false}, {...metadata, externalDispatchEnabled:true}]) {
  expect(services.verifyFourthSearchMetadata(invalid, stamp)).toBe(false);
 }
});
