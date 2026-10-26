import { createChatGptConnectionService, getChatGptConnectionStateNative } from '../chatgpt/chatgptConnectionService';
import type { ChatGptConnectionService, ChatGptConnectionState } from '../chatgpt/types';
import type { AiConnectionService, AiConnectionState } from '../ai/types';
export const READ_ONLY_GUIDANCE = '이 QA 앱은 기존 ChatGPT 연결을 읽기 전용으로 사용합니다. 로그인·연결 해제는 원래 BOGUNON DESK에서 처리한 뒤 이 앱을 다시 실행해 주세요.';
export function createReadOnlyConnection(): ChatGptConnectionService {
 const base = createChatGptConnectionService(getChatGptConnectionStateNative);
 const listeners = new Set<(state: ChatGptConnectionState) => void>();
 let state = base.getState();
 base.subscribe(next => { state = next; listeners.forEach(listener => listener(state)); });
 const blocked = async () => { state = { ...state, error: READ_ONLY_GUIDANCE }; listeners.forEach(listener => listener(state)); };
 return { getState: () => state, subscribe: listener => { listeners.add(listener); listener(state); return () => { listeners.delete(listener); }; }, refresh: base.refresh, startSignIn: blocked, disconnect: blocked };
}
export function createDisabledApiConnection(): AiConnectionService {
 const guidance = '이 격리 QA 앱에서는 API Key 연결을 사용하지 않습니다. 기존 ChatGPT 요금제 연결을 선택해 주세요.';
 let state: AiConnectionState = { status: 'disconnected', provider: null, model: null, error: null, canRetry: false };
 const listeners = new Set<(state: AiConnectionState) => void>();
 const blocked = () => { state = { ...state, error: guidance }; listeners.forEach(listener => listener(state)); };
 return { getState: () => state, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, connect: async () => blocked(), validate: async () => blocked(), generateText: async () => { throw new Error(guidance); }, disconnect: blocked };
}
export const APPROVED_SEARCH_CONDITIONS = { topic: '마약류 예방교육', target: '고등학생', minutes: 20, publicFirst: true } as const;
export const APPROVED_SEARCH_PROMPT_SHA256 = 'e806072de6813dbb960686403f4d88f4eef5a682c3f13909d441b14f85b4e802';
export function verifyFifthSearchMetadata(value: unknown, stamp: { readonly sourceSha: string; readonly baseSha: string }): boolean {
 return typeof value === 'object' && value !== null
  && 'identifier' in value && value.identifier === 'kr.sungandi.schoolhealthdesk.finderliveqa5'
  && 'sourceSha' in value && value.sourceSha === stamp.sourceSha && 'baseSha' in value && value.baseSha === stamp.baseSha
  && 'readOnlyAuth' in value && value.readOnlyAuth === true && 'libraryIsolated' in value && value.libraryIsolated === true
  && 'priorEvidenceReceiptsVerified' in value && value.priorEvidenceReceiptsVerified === true
  && 'externalDispatchEnabled' in value && value.externalDispatchEnabled === false
  && 'preparedSlot' in value && value.preparedSlot === 5
  && 'searchSlotFiveApproved' in value && typeof value.searchSlotFiveApproved === 'boolean'
  && 'searchSlotFiveUsed' in value && value.searchSlotFiveUsed === false
  && 'searchToolChoice' in value && value.searchToolChoice === 'auto'
  && 'sseDiagnosticsVersion' in value && value.sseDiagnosticsVersion === 3;
}

export function fifthSearchApproved(value: unknown): boolean {
 return typeof value === 'object' && value !== null
  && 'searchSlotFiveApproved' in value && value.searchSlotFiveApproved === true;
}
