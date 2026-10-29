import type { AiConnectionState } from '../ai/types';
import type { AiFinderConnection } from '../education-video/AiVideoFinder';

export class FinderQaBlockedError extends Error {
  constructor() { super('격리 QA에서는 인증·AI·모델 조회·외부 연결을 사용할 수 없습니다.'); this.name = 'FinderQaBlockedError'; }
}
export const blocked = async (): Promise<never> => { throw new FinderQaBlockedError(); };

export const finderQaConnection: AiFinderConnection = {
  state: { status: 'disconnected', email: null, displayName: null, planUsageEnabled: false,
    clientRegistrationExists: false, showPlanUsageNotice: false, notice: null,
    isLoading: false, isSigningIn: false, isDisconnecting: false, error: null },
  models: [], selectedModel: null, setSelectedModel: () => undefined,
  supportsWebSearch: false, searchWeb: blocked, generateText: blocked,
};

const aiState: AiConnectionState = { status: 'disconnected', provider: null, model: null, error: null, canRetry: false };
export const useAiConnection = () => ({
  state: aiState, provider: 'openai' as const, model: '', apiKey: '',
  setProvider: () => undefined, setModel: () => undefined, setApiKey: () => undefined,
  connect: blocked, validate: blocked, generateText: blocked, disconnect: () => undefined,
});
export const useChatGptConnection = () => ({
  ...finderQaConnection, refresh: blocked, startSignIn: blocked, disconnect: blocked,
  modelsLoading: false, modelsError: null, refreshModels: blocked,
});
