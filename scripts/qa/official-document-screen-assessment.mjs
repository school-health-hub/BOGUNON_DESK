export function assessNativeScreen(controls, captureKind) {
  const names = Array.isArray(controls) ? controls.map(control => control.name ?? '') : [];
  const loadError = names.some(name => /ERR_FILE_NOT_FOUND|^File not found$|^ERR_[A-Z_]+$/.test(name));
  const initialized = names.includes('공문 작업실') && names.includes('기본 초안 만들기');
  const visibleHeading = Array.isArray(controls) && controls.some(control => control.name === '공문 작업실' && control.offscreen !== true);
  return {
    frontendScreen: loadError ? 'FAIL' : initialized && visibleHeading && captureKind === 'foreground-qa-window' ? 'PASS' : 'NOT RUN',
    frontendLoadError: loadError,
    frontendInitializedViaUia: initialized,
    screenshotAvailable: captureKind !== null,
    captureKind,
    blankScreen: initialized ? 'NOT DETECTED - application controls present' : 'UNDETERMINED - inspect screenshot',
  };
}
