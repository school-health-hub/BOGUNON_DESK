import type { DesktopActionOutcome } from '../../../src/desktop/types';
export const executeNativeDesktopAction = async (): Promise<DesktopActionOutcome> => ({status:'unavailable',message:'이 기능은 ELECTRON-P0에 연결되지 않았습니다.'});
