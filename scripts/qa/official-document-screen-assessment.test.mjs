import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessNativeScreen } from './official-document-screen-assessment.mjs';
test('native frontend evidence is independent of absent CDP', () => {
  assert.equal(assessNativeScreen([{name:'공문 작업실'},{name:'기본 초안 만들기'}], true).frontendScreen, 'PASS');
});
test('actual file error fails even if application markers remain', () => {
  assert.equal(assessNativeScreen([{name:'공문 작업실'},{name:'기본 초안 만들기'},{name:'ERR_FILE_NOT_FOUND'}], true).frontendScreen, 'FAIL');
});
test('empty or missing screenshot evidence cannot pass', () => {
  assert.equal(assessNativeScreen([], true).frontendScreen, 'NOT RUN');
  assert.equal(assessNativeScreen([{name:'공문 작업실'},{name:'기본 초안 만들기'}], false).frontendScreen, 'NOT RUN');
});
