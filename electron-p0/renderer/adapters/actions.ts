import type { DesktopActionOutcome } from '../../../src/desktop/types';
export const executeNativeDesktopAction = async (): Promise<DesktopActionOutcome> => ({status:'unavailable',message:'이 기능은 현재 Windows 베타 버전에서 사용할 수 없습니다.'});
