import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

describe('official document QA WebView2 path contract', () => {
  it('uses Tauri identifier-scoped default storage without a relative override', () => {
    const qa = JSON.parse(read('src-tauri/tauri.official-document-qa.conf.json'));
    const production = JSON.parse(read('src-tauri/tauri.conf.json'));
    expect(qa.identifier).toBe('kr.sungandi.schoolhealthdesk.officialdocumentqa');
    expect(qa.identifier).not.toBe(production.identifier);
    expect(qa.app.windows[0].dataDirectory).toBeNull();
    expect(production.identifier).toBe('kr.sungandi.schoolhealthdesk');
  });

  it('retains strict native and frontend checks for the identifier EBWebView directory', () => {
    const rust = read('src-tauri/src/official_document_qa.rs');
    expect(rust).toContain('const QA_WEBVIEW_DIRECTORY: &str = "EBWebView"');
    expect(rust).toContain('verify_webview_root(&local_data)?');
    expect(rust).toContain('reject_reparse_ancestors(&webview_root)?');
    expect(rust).toContain('!metadata.is_dir() || is_reparse_point(&metadata)');
    expect(read('src/official-document-qa/OfficialDocumentQaApp.tsx')).toContain('EBWebView');
  });
});
