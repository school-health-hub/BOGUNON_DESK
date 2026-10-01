import { calculateBinary, formatCalculatorNumber } from "./arithmetic";
import type { CalculatorOperator, CalculatorState } from "./types";

const MAX_INPUT_LENGTH = 14;

export const createCalculatorState = (): CalculatorState => ({
  display: "0",
  expression: "",
  storedValue: null,
  pendingOperator: null,
  waitingForOperand: false,
  error: false,
});

const recoverForInput = (state: CalculatorState): CalculatorState => state.error
  ? createCalculatorState()
  : state;

export const pressDigit = (state: CalculatorState, digit: string): CalculatorState => {
  const current = recoverForInput(state);
  if (!/^\d$/.test(digit)) return current;
  if (current.waitingForOperand) return { ...current, display: digit, waitingForOperand: false };
  if (current.display.replace("-", "").replace(".", "").length >= MAX_INPUT_LENGTH) return current;
  return { ...current, display: current.display === "0" ? digit : `${current.display}${digit}` };
};

export const pressDecimal = (state: CalculatorState): CalculatorState => {
  const current = recoverForInput(state);
  if (current.waitingForOperand) return { ...current, display: "0.", waitingForOperand: false };
  if (current.display.includes(".")) return current;
  return { ...current, display: `${current.display}.` };
};

export const pressClear = (_state: CalculatorState): CalculatorState => createCalculatorState();

export const pressBackspace = (state: CalculatorState): CalculatorState => {
  if (state.error || state.waitingForOperand) return createCalculatorState();
  const next = state.display.slice(0, -1);
  return { ...state, display: next === "" || next === "-" ? "0" : next };
};

export const toggleSign = (state: CalculatorState): CalculatorState => {
  const current = recoverForInput(state);
  if (current.display === "0") return current;
  return { ...current, display: current.display.startsWith("-") ? current.display.slice(1) : `-${current.display}` };
};

export const pressPercent = (state: CalculatorState): CalculatorState => {
  const current = recoverForInput(state);
  return { ...current, display: formatCalculatorNumber(Number(current.display) / 100) };
};

const operatorSymbol = (operator: CalculatorOperator): string => {
  switch (operator) {
    case "+": return "+";
    case "-": return "−";
    case "multiply": return "×";
    case "divide": return "÷";
  }
};

const resolvePending = (state: CalculatorState): CalculatorState => {
  if (state.pendingOperator === null || state.storedValue === null || state.waitingForOperand) return state;
  const result = calculateBinary(state.storedValue, Number(state.display), state.pendingOperator);
  if (result === null) return { ...createCalculatorState(), display: "계산할 수 없습니다.", error: true };
  return { ...state, display: formatCalculatorNumber(result), storedValue: result };
};

export const pressOperator = (state: CalculatorState, operator: CalculatorOperator): CalculatorState => {
  const current = recoverForInput(state);
  const resolved = resolvePending(current);
  if (resolved.error) return resolved;
  const value = Number(resolved.display);
  return {
    ...resolved,
    expression: `${formatCalculatorNumber(value)} ${operatorSymbol(operator)}`,
    storedValue: value,
    pendingOperator: operator,
    waitingForOperand: true,
  };
};

export const pressEquals = (state: CalculatorState): CalculatorState => {
  if (state.error) return state;
  if (state.pendingOperator === null || state.storedValue === null || state.waitingForOperand) return state;
  const right = Number(state.display);
  const result = calculateBinary(state.storedValue, right, state.pendingOperator);
  if (result === null) return { ...createCalculatorState(), display: "계산할 수 없습니다.", error: true };
  return {
    ...createCalculatorState(),
    display: formatCalculatorNumber(result),
    expression: `${state.expression} ${formatCalculatorNumber(right)} =`,
    waitingForOperand: true,
  };
};
