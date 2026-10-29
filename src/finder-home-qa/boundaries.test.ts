// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { allowsFinderQaCommand, invoke } from './qaIpc';
import { allowsQaIpcRequest } from './networkBoundary';
import { FINDER_QA_IDENTIFIER, parseFinderQaMetadata } from './metadata';
import { finderQaConnection, FinderQaBlockedError, useChatGptConnection } from './inertConnections';
import { getSupabaseClient } from './inertSupabase';

const sha = '25e5a5c021ad1bc0d6e53699ae646dc9f71bd51e';
const metadata = {
  identifier: FINDER_QA_IDENTIFIER, sourceSha: sha,
  localData: `E:/BOGUNON_DEV/qa-output/finder-home-qa-example/data/${FINDER_QA_IDENTIFIER}/education-video`,
  webviewData: 'E:/BOGUNON_DEV/qa-output/finder-home-qa-example/webview', networkEnabled: false,
  authEnabled: false, externalConnections: false, syntheticOnly: true,
};

describe('Finder QA boundaries', () => {
  it('allows only the QA metadata and local library commands', async () => {
    // Given the command allowlist, when an operational command is requested,
    // then it is rejected before the native bridge.
    expect(allowsFinderQaCommand('education_video_library_load')).toBe(true);
    expect(allowsFinderQaCommand('finder_home_qa_metadata')).toBe(true);
    for (const command of ['chatgpt_search_web', 'chatgpt_list_models', 'education_video_search', 'open_quick_memo_url', 'plugin:opener|open_url']) {
      await expect(invoke(command)).rejects.toBeInstanceOf(FinderQaBlockedError);
    }
  });
  it('permits only fixed local IPC POST transport and denies network lookalikes', () => {
    // Given local IPC URLs, when their method/destination/command changes,
    // then only the exact local allowlist survives.
    expect(allowsQaIpcRequest('http://ipc.localhost/education_video_library_load', { method: 'POST' })).toBe(true);
    for (const url of ['https://api.openai.com/v1/responses', 'http://localhost:3000/education_video_library_load', 'http://ipc.localhost/chatgpt_search_web', 'http://ipc.localhost:123/education_video_library_load', 'http://ipc.localhost/education_video_library_load?url=https://example.test']) {
      expect(allowsQaIpcRequest(url, { method: 'POST' })).toBe(false);
    }
    expect(allowsQaIpcRequest('http://ipc.localhost/education_video_library_load')).toBe(false);
  });
  it('fails closed for nonisolated native metadata and a mismatched source', () => {
    // Given metadata from native, when its source or isolation flags differ,
    // then the workspace may not mount.
    expect(parseFinderQaMetadata(metadata, sha)).not.toBeNull();
    expect(parseFinderQaMetadata({ ...metadata, sourceSha: '0'.repeat(40) }, sha)).toBeNull();
    expect(parseFinderQaMetadata({ ...metadata, externalConnections: true }, sha)).toBeNull();
    expect(parseFinderQaMetadata({ ...metadata, localData: 'C:/Users/operating/AppData' }, sha)).toBeNull();
    expect(parseFinderQaMetadata({ ...metadata, webviewData: 'E:/other/webview' }, sha)).toBeNull();
  });
  it('rejects search, generation, OAuth, and model refresh without providers', async () => {
    // Given inert connections, when any remote action is invoked,
    // then it fails without a service or account provider.
    await expect(finderQaConnection.searchWeb('합성')).rejects.toBeInstanceOf(FinderQaBlockedError);
    await expect(finderQaConnection.generateText('합성')).rejects.toBeInstanceOf(FinderQaBlockedError);
    await expect(useChatGptConnection().startSignIn()).rejects.toBeInstanceOf(FinderQaBlockedError);
    await expect(useChatGptConnection().refreshModels()).rejects.toBeInstanceOf(FinderQaBlockedError);
    expect(() => getSupabaseClient()).toThrow(FinderQaBlockedError);
  });
});
