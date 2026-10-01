export const calculatorOperators = ["+", "-", "multiply", "divide"] as const;
export type CalculatorOperator = (typeof calculatorOperators)[number];

export type CalculatorState = {
  readonly display: string;
  readonly expression: string;
  readonly storedValue: number | null;
  readonly pendingOperator: CalculatorOperator | null;
  readonly waitingForOperand: boolean;
  readonly error: boolean;
};

export type CalculationResult =
  | { readonly status: "ready"; readonly value: number }
  | { readonly status: "error" };
