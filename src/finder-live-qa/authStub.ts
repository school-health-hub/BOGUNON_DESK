import type { AuthState } from '../auth/types';
const state: AuthState = { status: 'signedOut', user: null, notice: null };
export const authService = { getState: () => state, subscribe: (listener: (state: AuthState) => void) => { listener(state); return () => {}; } };
export function getSupabaseClient(): never { throw new Error('Supabase 연결은 격리 Finder Live QA에서 사용할 수 없습니다.'); }
