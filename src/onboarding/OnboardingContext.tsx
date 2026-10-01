import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { OnboardingDialog } from "../components/desktop/OnboardingDialog";
import { onboardingService } from "./onboardingService";

type OnboardingContextValue = {
  readonly open: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { readonly children: ReactNode }) {
  const auth = useAuth();
  const [isOpen, setIsOpen] = useState(onboardingService.shouldShow);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback((): void => {
    setStep(1);
    setError(null);
    setIsOpen(true);
  }, []);

  const complete = (): void => {
    try {
      onboardingService.complete();
      setIsOpen(false);
      setStep(1);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error
        ? "처음 사용 안내 상태를 저장하지 못했습니다. 다시 시도해 주세요."
        : "처음 사용 안내를 완료하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  const value = useMemo<OnboardingContextValue>(() => ({ open }), [open]);
  const authError = auth.state.notice?.message ?? error;

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {isOpen && (
        <OnboardingDialog
          authStatus={auth.state.status}
          error={authError}
          step={step}
          onBack={() => setStep((current) => current === 3 ? 2 : 1)}
          onComplete={complete}
          onConnectGoogle={() => void auth.signInWithGoogle()}
          onNext={() => setStep((current) => current === 1 ? 2 : 3)}
        />
      )}
    </OnboardingContext.Provider>
  );
}

export const useOnboarding = (): OnboardingContextValue => {
  const value = useContext(OnboardingContext);
  if (value === null) throw new Error("OnboardingProvider가 필요합니다.");
  return value;
};
