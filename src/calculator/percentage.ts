import type { CalculationResult } from "./types";

export type ChangeRateResult =
  | { readonly status: "ready"; readonly direction: "increase" | "decrease" | "same"; readonly value: number }
  | { readonly status: "error" };

const roundOne = (value: number): number => Math.round(value * 10) / 10;

export const calculatePartPercentage = (part: number, total: number): CalculationResult => (
  Number.isFinite(part) && Number.isFinite(total) && total !== 0
    ? { status: "ready", value: roundOne((part / total) * 100) }
    : { status: "error" }
);

export const calculatePercentageValue = (total: number, percentage: number): CalculationResult => (
  Number.isFinite(total) && Number.isFinite(percentage)
    ? { status: "ready", value: (total * percentage) / 100 }
    : { status: "error" }
);

export const calculateChangeRate = (previous: number, current: number): ChangeRateResult => {
  if (!Number.isFinite(previous) || !Number.isFinite(current) || previous === 0) return { status: "error" };
  if (previous === current) return { status: "ready", direction: "same", value: 0 };
  return {
    status: "ready",
    direction: current > previous ? "increase" : "decrease",
    value: roundOne(Math.abs(((current - previous) / previous) * 100)),
  };
};

export const formatPercentage = (value: number): string => `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
export const formatLocaleNumber = (value: number): string => Number(value.toPrecision(12)).toLocaleString("ko-KR", { maximumFractionDigits: 6 });
