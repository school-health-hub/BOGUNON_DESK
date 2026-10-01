import { describe, expect, it } from "vitest";
import {
  createCalculatorState,
  pressBackspace,
  pressClear,
  pressDecimal,
  pressDigit,
  pressEquals,
  pressOperator,
  pressPercent,
  toggleSign,
} from "./calculatorMachine";

const enter = (digits: string) => [...digits].reduce((state, digit) => (
  digit === "." ? pressDecimal(state) : pressDigit(state, digit)
), createCalculatorState());

describe("calculator machine", () => {
  it.each([
    ["1", "+", "2", "3"],
    ["10", "-", "3", "7"],
    ["4", "multiply", "5", "20"],
    ["20", "divide", "4", "5"],
    ["1.5", "+", "2.25", "3.75"],
  ] as const)("calculates %s %s %s", (left, operator, right, expected) => {
    let state = enter(left);
    state = pressOperator(state, operator);
    state = [...right].reduce((current, digit) => digit === "." ? pressDecimal(current) : pressDigit(current, digit), state);
    expect(pressEquals(state).display).toBe(expected);
  });

  it("supports negative, percent, backspace, and clear", () => {
    expect(toggleSign(enter("12")).display).toBe("-12");
    expect(pressPercent(enter("25")).display).toBe("0.25");
    expect(pressBackspace(enter("123")).display).toBe("12");
    expect(pressClear(enter("123"))).toEqual(createCalculatorState());
  });

  it("recovers after division by zero and repeated operations", () => {
    let state = pressOperator(enter("8"), "divide");
    state = pressDigit(state, "0");
    expect(pressEquals(state).display).toBe("계산할 수 없습니다.");
    expect(pressDigit(pressEquals(state), "7").display).toBe("7");

    state = pressOperator(enter("2"), "+");
    state = pressDigit(state, "3");
    state = pressOperator(state, "multiply");
    state = pressDigit(state, "4");
    expect(pressEquals(state).display).toBe("20");
  });
});
