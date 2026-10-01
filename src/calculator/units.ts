import type { CalculationResult } from "./types";

export const unitIds = ["mm", "cm", "m", "g", "kg", "mL", "L"] as const;
export type UnitId = (typeof unitIds)[number];
export type UnitDimension = "length" | "weight" | "volume";

export const unitDefinitions = {
  mm: { dimension: "length", factor: 0.001 },
  cm: { dimension: "length", factor: 0.01 },
  m: { dimension: "length", factor: 1 },
  g: { dimension: "weight", factor: 0.001 },
  kg: { dimension: "weight", factor: 1 },
  mL: { dimension: "volume", factor: 0.001 },
  L: { dimension: "volume", factor: 1 },
} as const satisfies Record<UnitId, { readonly dimension: UnitDimension; readonly factor: number }>;

export const isUnitId = (value: string): value is UnitId => unitIds.some((unit) => unit === value);

export const convertUnit = (value: number, from: UnitId, to: UnitId): CalculationResult => {
  const source = unitDefinitions[from];
  const target = unitDefinitions[to];
  if (!Number.isFinite(value) || source.dimension !== target.dimension) return { status: "error" };
  return { status: "ready", value: Number(((value * source.factor) / target.factor).toPrecision(12)) };
};
