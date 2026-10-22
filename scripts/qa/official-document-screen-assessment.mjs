export function assessNativeScreen(controls, captureAvailable) {
  const names = Array.isArray(controls) ? controls.map(control => control.name ?? '') : [];
  const loadError = names.some(name => /ERR_FILE_NOT_FOUND|^File not found$|^ERR_[A-Z_]+$/.test(name));
  const initialized = names.includes('공문 작업실') && names.includes('기본 초안 만들기');
  return {
    frontendScreen: loadError ? 'FAIL' : initialized && captureAvailable ? 'PASS' : 'NOT RUN',
    frontendLoadError: loadError,
    frontendInitializedViaUia: initialized,
    screenshotAvailable: captureAvailable,
    blankScreen: initialized ? 'NOT DETECTED - application controls present' : 'UNDETERMINED - inspect screenshot',
  };
}
