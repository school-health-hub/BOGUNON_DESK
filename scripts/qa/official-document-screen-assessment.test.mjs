import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessNativeScreen } from './official-document-screen-assessment.mjs';
test('native frontend evidence is independent of absent CDP', () => {
  assert.equal(assessNativeScreen([{name:'공문 작업실'},{name:'기본 초안 만들기'}], 'foreground-qa-window').frontendScreen, 'PASS');
});
test('actual file error fails even if application markers remain', () => {
  assert.equal(assessNativeScreen([{name:'공문 작업실'},{name:'기본 초안 만들기'},{name:'ERR_FILE_NOT_FOUND'}], 'foreground-qa-window').frontendScreen, 'FAIL');
});
test('empty or missing screenshot evidence cannot pass', () => {
  assert.equal(assessNativeScreen([], 'foreground-qa-window').frontendScreen, 'NOT RUN');
  assert.equal(assessNativeScreen([{name:'공문 작업실'},{name:'기본 초안 만들기'}], null).frontendScreen, 'NOT RUN');
});
test('desktop fallback cannot establish native screen PASS', () => {
  assert.equal(assessNativeScreen([{name:'공문 작업실'},{name:'기본 초안 만들기'}], 'desktop-fallback').frontendScreen, 'NOT RUN');
});
test('offscreen-only markers cannot establish visible screen PASS', () => {
  assert.equal(assessNativeScreen([{name:'공문 작업실',offscreen:true},{name:'기본 초안 만들기',offscreen:true}], 'foreground-qa-window').frontendScreen, 'NOT RUN');
});
