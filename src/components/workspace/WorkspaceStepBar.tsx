import type { MouseEventHandler } from "react";
import "./workspace-step-bar.css";

export type WorkspaceStepState = "completed" | "available" | "disabled";

export type WorkspaceStep = {
  readonly id: string;
  readonly label: string;
  readonly state: WorkspaceStepState;
};

type WorkspaceStepBarProps = {
  readonly activeStepId: string;
  readonly ariaLabel: string;
  readonly onStepSelect?: (stepId: string) => void;
  readonly steps: readonly [WorkspaceStep, ...readonly WorkspaceStep[]];
};

const stepStateLabel: Readonly<Record<WorkspaceStepState, string>> = {
  completed: "완료",
  available: "이동 가능",
  disabled: "아직 사용할 수 없음",
};

export function WorkspaceStepBar({
  activeStepId,
  ariaLabel,
  onStepSelect,
  steps,
}: WorkspaceStepBarProps) {
  const requestedIndex = steps.findIndex((step) => step.id === activeStepId);
  const firstEnabledIndex = steps.findIndex((step) => step.state !== "disabled");
  const activeIndex = requestedIndex >= 0 ? requestedIndex : Math.max(firstEnabledIndex, 0);
  const activeStep = steps[activeIndex];

  return (
    <nav className="workspace-step-bar" aria-label={ariaLabel}>
      <p className="workspace-step-bar__compact" aria-live="polite">
        현재 단계 {activeIndex + 1}/{steps.length} · {activeStep.label}
      </p>
      <ol className="workspace-step-bar__list">
        {steps.map((step, index) => {
          const isCurrent = index === activeIndex;
          const isDisabled = step.state === "disabled";
          const selectStep: MouseEventHandler<HTMLButtonElement> = () => onStepSelect?.(step.id);

          return (
            <li
              className="workspace-step-bar__item"
              data-state={isCurrent ? "current" : step.state}
              key={step.id}
            >
              <button
                type="button"
                aria-current={isCurrent ? "step" : undefined}
                disabled={isDisabled}
                onClick={selectStep}
              >
                <span className="workspace-step-bar__number" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="workspace-step-bar__label">{step.label}</span>
                <span className="workspace-step-bar__state">{isCurrent ? "현재" : stepStateLabel[step.state]}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
