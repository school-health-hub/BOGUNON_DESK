import type { CalculatorOperator } from "./types";

const MAX_DISPLAY_LENGTH = 14;

export const formatCalculatorNumber = (value: number): string => {
  if (!Number.isFinite(value)) return "계산할 수 없습니다.";
  const rounded = Number(value.toPrecision(12));
  const text = String(rounded);
  if (text.length <= MAX_DISPLAY_LENGTH) return text;
  return rounded.toExponential(8);
};

export const calculateBinary = (
  left: number,
  right: number,
  operator: CalculatorOperator,
): number | null => {
  switch (operator) {
    case "+": return left + right;
    case "-": return left - right;
    case "multiply": return left * right;
    case "divide": return right === 0 ? null : left / right;
  }
};
