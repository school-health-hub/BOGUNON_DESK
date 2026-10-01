import { Calculator, Copy, Delete, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
} from "../../calculator/calculatorMachine";
import { calculateDateDifference } from "../../calculator/dateDifference";
import {
  calculateChangeRate,
  calculatePartPercentage,
  calculatePercentageValue,
  formatLocaleNumber,
  formatPercentage,
} from "../../calculator/percentage";
import type { CalculatorOperator } from "../../calculator/types";
import { convertUnit, isUnitId, unitDefinitions, unitIds, type UnitDimension, type UnitId } from "../../calculator/units";

const tabIds = ["basic", "percentage", "date", "unit"] as const;
type CalculatorTab = (typeof tabIds)[number];
const tabLabels: Readonly<Record<CalculatorTab, string>> = { basic: "일반", percentage: "퍼센트", date: "날짜", unit: "단위" };
const percentageModes = ["part", "value", "change"] as const;
type PercentageMode = (typeof percentageModes)[number];

type CalculatorPanelProps = {
  readonly initialDate: string;
  readonly onClose: () => void;
  readonly onNotice: (message: string) => void;
};

const parseNumber = (value: string): number | null => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const operatorLabels: Readonly<Record<CalculatorOperator, string>> = { "+": "+", "-": "−", multiply: "×", divide: "÷" };
const isCalculatorOperator = (value: string): value is CalculatorOperator => value === "+" || value === "-" || value === "multiply" || value === "divide";

export function CalculatorPanel({ initialDate, onClose, onNotice }: CalculatorPanelProps) {
  const [tab, setTab] = useState<CalculatorTab>("basic");
  const [calculator, setCalculator] = useState(createCalculatorState);
  const [percentageMode, setPercentageMode] = useState<PercentageMode>("part");
  const [firstValue, setFirstValue] = useState("");
  const [secondValue, setSecondValue] = useState("");
  const [startDate, setStartDate] = useState(initialDate);
  const [endDate, setEndDate] = useState(initialDate);
  const [unitValue, setUnitValue] = useState("");
  const [fromUnit, setFromUnit] = useState<UnitId>("mL");
  const [toUnit, setToUnit] = useState<UnitId>("L");

  const percentageResult = useMemo(() => {
    const first = parseNumber(firstValue);
    const second = parseNumber(secondValue);
    if (first === null || second === null) return null;
    if (percentageMode === "part") {
      const result = calculatePartPercentage(first, second);
      return result.status === "ready" ? formatPercentage(result.value) : "계산할 수 없습니다.";
    }
    if (percentageMode === "value") {
      const result = calculatePercentageValue(first, second);
      return result.status === "ready" ? formatLocaleNumber(result.value) : "계산할 수 없습니다.";
    }
    const result = calculateChangeRate(first, second);
    if (result.status === "error") return "계산할 수 없습니다.";
    if (result.direction === "same") return "변화 없음";
    return `${result.direction === "increase" ? "증가" : "감소"} ${formatPercentage(result.value)}`;
  }, [firstValue, percentageMode, secondValue]);

  const dateResult = useMemo(() => calculateDateDifference(startDate, endDate), [endDate, startDate]);
  const unitResult = useMemo(() => {
    const value = parseNumber(unitValue);
    if (value === null) return null;
    const result = convertUnit(value, fromUnit, toUnit);
    return result.status === "ready" ? `${formatLocaleNumber(result.value)} ${toUnit}` : "변환할 수 없습니다.";
  }, [fromUnit, toUnit, unitValue]);

  const copyText = tab === "basic"
    ? calculator.error ? null : calculator.display
    : tab === "percentage" ? percentageResult
      : tab === "date" && dateResult.status === "ready" ? `날짜 차이 ${dateResult.days}일 · 양끝 날짜 포함 ${dateResult.inclusiveDays}일`
        : tab === "unit" ? unitResult : null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (tab !== "basic") return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;
      if (/^\d$/.test(event.key)) setCalculator((current) => pressDigit(current, event.key));
      else if (event.key === ".") setCalculator(pressDecimal);
      else if (event.key === "+") setCalculator((current) => pressOperator(current, "+"));
      else if (event.key === "-") setCalculator((current) => pressOperator(current, "-"));
      else if (event.key === "*") setCalculator((current) => pressOperator(current, "multiply"));
      else if (event.key === "/") setCalculator((current) => pressOperator(current, "divide"));
      else if (event.key === "Enter" || event.key === "=") setCalculator(pressEquals);
      else if (event.key === "Backspace") setCalculator(pressBackspace);
      else if (event.key === "%") setCalculator(pressPercent);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, tab]);

  const copyResult = async (): Promise<void> => {
    if (copyText === null) return;
    try {
      await navigator.clipboard.writeText(copyText);
      onNotice("계산 결과를 복사했습니다.");
    } catch (error: unknown) {
      if (error instanceof Error) onNotice("계산 결과를 복사하지 못했습니다.");
      else throw error;
    }
  };

  const setUnitDimension = (dimension: UnitDimension) => {
    const matching = unitIds.filter((unit) => unitDefinitions[unit].dimension === dimension);
    const first = matching[0];
    const second = matching[1] ?? first;
    if (first !== undefined && second !== undefined) { setFromUnit(first); setToUnit(second); }
  };

  return (
    <div className="calculator-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="calculator-panel" role="dialog" aria-modal="true" aria-label="업무 계산기">
        <header>
          <div className="calculator-panel__title-icon"><Calculator size={18} /></div>
          <div><strong>업무 계산기</strong><span>계산·퍼센트·날짜·단위 변환</span></div>
          <button type="button" aria-label="계산기 닫기" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="calculator-panel__tabs" role="tablist" aria-label="계산기 종류">
          {tabIds.map((id) => <button type="button" role="tab" aria-selected={tab === id} className={tab === id ? "is-active" : ""} key={id} onClick={() => setTab(id)}>{tabLabels[id]}</button>)}
        </div>
        <div className="calculator-panel__body">
          {tab === "basic" && <BasicCalculator state={calculator} setState={setCalculator} />}
          {tab === "percentage" && <PercentageCalculator mode={percentageMode} first={firstValue} second={secondValue} result={percentageResult} onMode={setPercentageMode} onFirst={setFirstValue} onSecond={setSecondValue} />}
          {tab === "date" && <DateCalculator start={startDate} end={endDate} result={dateResult} today={initialDate} onStart={setStartDate} onEnd={setEndDate} />}
          {tab === "unit" && <UnitCalculator value={unitValue} from={fromUnit} to={toUnit} result={unitResult} onValue={setUnitValue} onFrom={setFromUnit} onTo={setToUnit} onDimension={setUnitDimension} />}
        </div>
        <footer><button type="button" disabled={copyText === null} onClick={() => void copyResult()}><Copy size={14} /> 결과 복사</button></footer>
      </section>
    </div>
  );
}

type BasicProps = { readonly state: ReturnType<typeof createCalculatorState>; readonly setState: React.Dispatch<React.SetStateAction<ReturnType<typeof createCalculatorState>>> };
function BasicCalculator({ state, setState }: BasicProps) {
  const keys = ["C", "sign", "%", "divide", "7", "8", "9", "multiply", "4", "5", "6", "-", "1", "2", "3", "+", "backspace", "0", ".", "equals"] as const;
  return <div className="calculator-basic"><div className="calculator-display" aria-live="polite"><small>{state.expression || "현재 계산"}</small><strong>{state.display}</strong></div><div className="calculator-keypad">{keys.map((key) => {
    const isOperator = isCalculatorOperator(key);
    const label = key === "sign" ? "+/−" : key === "backspace" ? <Delete size={17} /> : key === "equals" ? "=" : isOperator ? operatorLabels[key] : key;
    const action = () => setState((current) => {
      if (key === "C") return pressClear(current);
      if (key === "sign") return toggleSign(current);
      if (key === "%") return pressPercent(current);
      if (key === "backspace") return pressBackspace(current);
      if (key === "equals") return pressEquals(current);
      if (key === ".") return pressDecimal(current);
      if (/^\d$/.test(key)) return pressDigit(current, key);
      return isCalculatorOperator(key) ? pressOperator(current, key) : current;
    });
    return <button className={key === "equals" ? "is-primary" : key in operatorLabels ? "is-operator" : ""} type="button" aria-label={key === "backspace" ? "한 자리 지우기" : String(label)} key={key} onClick={action}>{label}</button>;
  })}</div></div>;
}

type PercentageProps = { readonly mode: PercentageMode; readonly first: string; readonly second: string; readonly result: string | null; readonly onMode: (value: PercentageMode) => void; readonly onFirst: (value: string) => void; readonly onSecond: (value: string) => void };
function PercentageCalculator({ mode, first, second, result, onMode, onFirst, onSecond }: PercentageProps) {
  const labels = mode === "part" ? ["일부", "전체"] : mode === "value" ? ["전체", "퍼센트"] : ["이전 값", "현재 값"];
  return <div className="calculator-form"><div className="calculator-segmented">{percentageModes.map((id) => <button type="button" className={mode === id ? "is-active" : ""} key={id} onClick={() => onMode(id)}>{id === "part" ? "일부 비율" : id === "value" ? "퍼센트 값" : "증감률"}</button>)}</div><label><span>{labels[0]}</span><input type="number" inputMode="decimal" value={first} onChange={(event) => onFirst(event.currentTarget.value)} /></label><label><span>{labels[1]}</span><input type="number" inputMode="decimal" value={second} onChange={(event) => onSecond(event.currentTarget.value)} /></label><Result value={result} /></div>;
}

type DateProps = { readonly start: string; readonly end: string; readonly result: ReturnType<typeof calculateDateDifference>; readonly today: string; readonly onStart: (value: string) => void; readonly onEnd: (value: string) => void };
function DateCalculator({ start, end, result, today, onStart, onEnd }: DateProps) {
  const text = result.status === "ready" ? `날짜 차이 ${result.days}일 · 양끝 날짜 포함 ${result.inclusiveDays}일` : result.status === "reversed" ? "종료일이 시작일보다 빠릅니다." : "날짜를 확인해 주세요.";
  return <div className="calculator-form"><label><span>시작일</span><span className="calculator-date-field"><input type="date" value={start} onChange={(event) => onStart(event.currentTarget.value)} /><button type="button" onClick={() => onStart(today)}>오늘</button></span></label><label><span>종료일</span><span className="calculator-date-field"><input type="date" value={end} onChange={(event) => onEnd(event.currentTarget.value)} /><button type="button" onClick={() => onEnd(today)}>오늘</button></span></label><Result value={text} /></div>;
}

type UnitProps = { readonly value: string; readonly from: UnitId; readonly to: UnitId; readonly result: string | null; readonly onValue: (value: string) => void; readonly onFrom: (value: UnitId) => void; readonly onTo: (value: UnitId) => void; readonly onDimension: (value: UnitDimension) => void };
function UnitCalculator({ value, from, to, result, onValue, onFrom, onTo, onDimension }: UnitProps) {
  const dimension = unitDefinitions[from].dimension;
  const options = unitIds.filter((unit) => unitDefinitions[unit].dimension === dimension);
  return <div className="calculator-form"><div className="calculator-segmented">{(["length", "weight", "volume"] as const).map((id) => <button type="button" className={dimension === id ? "is-active" : ""} key={id} onClick={() => onDimension(id)}>{id === "length" ? "길이" : id === "weight" ? "무게" : "부피"}</button>)}</div><label><span>값</span><input type="number" inputMode="decimal" value={value} onChange={(event) => onValue(event.currentTarget.value)} /></label><div className="calculator-unit-row"><label><span>변환 전</span><select value={from} onChange={(event) => { const next = event.currentTarget.value; if (isUnitId(next)) onFrom(next); }}>{options.map((unit) => <option key={unit}>{unit}</option>)}</select></label><span>→</span><label><span>변환 후</span><select value={to} onChange={(event) => { const next = event.currentTarget.value; if (isUnitId(next)) onTo(next); }}>{options.map((unit) => <option key={unit}>{unit}</option>)}</select></label></div><Result value={result} /></div>;
}

function Result({ value }: { readonly value: string | null }) {
  return <output className="calculator-result" aria-live="polite">{value ?? "값을 입력하세요."}</output>;
}
