export type DecimalFraction = { readonly numerator: bigint; readonly denominator: bigint };
export type DecimalResult = { readonly kind: "valid"; readonly value: DecimalFraction } | { readonly kind: "invalid" };
const decimalPattern = /^(0|[1-9]\d*)(?:\.(\d+))?$/;

const greatestCommonDivisor = (left: bigint, right: bigint): bigint => {
  let a = left;
  let b = right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
};

export const parseNonnegativeDecimal = (raw: string): DecimalResult => {
  const match = decimalPattern.exec(raw);
  if (match === null || match[1] === undefined) return { kind: "invalid" };
  const fractional = match[2] ?? "";
  const denominator = 10n ** BigInt(fractional.length);
  const numerator = BigInt(`${match[1]}${fractional}`);
  const divisor = greatestCommonDivisor(numerator, denominator);
  return { kind: "valid", value: { numerator: numerator / divisor, denominator: denominator / divisor } };
};

export const multiplyFractions = (left: DecimalFraction, right: DecimalFraction): DecimalFraction => {
  const numerator = left.numerator * right.numerator;
  const denominator = left.denominator * right.denominator;
  const divisor = greatestCommonDivisor(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
};

export const fractionToPositiveSafeNumber = (value: DecimalFraction): number | null => {
  if (value.numerator <= 0n) return null;
  let denominator = value.denominator;
  let scale = 0;
  while (denominator % 2n === 0n) denominator /= 2n;
  if (denominator !== 1n) return null;
  denominator = value.denominator;
  while (denominator > 1n) {
    denominator /= 2n;
    scale += 1;
  }
  const digits = (value.numerator * (5n ** BigInt(scale))).toString();
  const decimal = scale === 0
    ? digits
    : digits.length <= scale
      ? `0.${"0".repeat(scale - digits.length)}${digits}`
      : `${digits.slice(0, digits.length - scale)}.${digits.slice(digits.length - scale)}`;
  const result = Number(decimal);
  if (!Number.isFinite(result) || result <= 0 || result > Number.MAX_SAFE_INTEGER) return null;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, result);
  const bits = view.getBigUint64(0);
  const exponent = Number((bits >> 52n) & 0x7ffn);
  const significand = (bits & ((1n << 52n) - 1n)) + (exponent === 0 ? 0n : 1n << 52n);
  const shift = exponent === 0 ? -1074 : exponent - 1075;
  const binaryNumerator = shift >= 0 ? significand << BigInt(shift) : significand;
  const binaryDenominator = shift >= 0 ? 1n : 1n << BigInt(-shift);
  return binaryNumerator * value.denominator === value.numerator * binaryDenominator ? result : null;
};

export const fractionToNonnegativeSafeInteger = (value: DecimalFraction): number | null => value.denominator === 1n && value.numerator >= 0n && value.numerator <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value.numerator) : null;
export const fractionToIntegerString = (value: DecimalFraction): string | null => value.denominator === 1n ? value.numerator.toString() : null;
