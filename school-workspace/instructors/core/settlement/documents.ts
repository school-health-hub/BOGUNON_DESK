import { calculateHealthSupportInstructorManager } from "../domain.js";

type SettlementInstructor = {
  readonly id: string;
  readonly name: string;
  readonly subject: string;
  readonly hourlyRate: number;
  readonly monthlyInsurance: number;
  readonly monthlyHourLimit: number;
  readonly weeklyHourLimit: number;
  readonly totalBudget: number;
  readonly weeklyHours?: number;
  readonly operationStartDate?: string;
  readonly operationEndDate?: string;
};

type SettlementWorkLog = {
  readonly instructorId: string;
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly note?: string | null;
};

export type HealthSupportSettlementDocumentInput = {
  readonly instructor: SettlementInstructor;
  readonly month: string;
  readonly workLogs: readonly SettlementWorkLog[];
};

type SettlementWarning =
  | { readonly kind: "weeklyWarning"; readonly isoWeekKey: string; readonly hours: number; readonly warningHours: number; readonly limitHours: number }
  | { readonly kind: "weeklyLimit"; readonly isoWeekKey: string; readonly hours: number; readonly limitHours: number }
  | { readonly kind: "monthlyLimit"; readonly month: string; readonly hours: number; readonly limitHours: number };

type MonthlyWorkDetailRow = {
  readonly date: string;
  readonly weekday: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly hours: number;
};

type AttendanceRegisterRow = {
  readonly date: string;
  readonly weekday: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly signature: "";
  readonly teacherConfirmation: "";
};

export type PaymentStatementRow = {
  readonly date: string;
  readonly weekday: string;
  readonly hours: number;
  readonly note: string;
  readonly isoWeekKey: string;
};

export type PaymentStatementWeeklyTotal = {
  readonly isoWeekKey: string;
  readonly hours: number;
};

export type HealthSupportSettlementDocuments = {
  readonly settlement: {
    readonly instructorId: string;
    readonly instructorName: string;
    readonly subject: string;
    readonly month: string;
    readonly hourlyRate: number;
    readonly hours: number;
    readonly wages: number;
    readonly insurance: number;
    readonly total: number;
    readonly monthlyLimitWarning: boolean;
  };
  readonly paymentStatement: {
    readonly instructorId: string;
    readonly month: string;
    readonly instructorName: string;
    readonly weeklyHours: number;
    readonly subject: string;
    readonly hourlyRate: number;
    readonly hours: number;
    readonly amount: number;
    readonly rows: readonly PaymentStatementRow[];
    readonly weeklyTotals: readonly PaymentStatementWeeklyTotal[];
  };
  readonly monthlyWorkDetail: {
    readonly instructorId: string;
    readonly month: string;
    readonly rows: readonly MonthlyWorkDetailRow[];
    readonly totalHours: number;
  };
  readonly attendanceRegister: {
    readonly title: string;
    readonly field: "학교보건지원강사";
    readonly instructorName: string;
    readonly operationPeriod: string;
    readonly workDays: number;
    readonly rows: readonly AttendanceRegisterRow[];
  };
  readonly warnings: readonly SettlementWarning[];
  readonly budget: {
    readonly total: number;
    readonly spent: number;
    readonly remaining: number;
    readonly status: "execution" | "overrun";
  };
};

export function createHealthSupportSettlementDocuments(input: HealthSupportSettlementDocumentInput): HealthSupportSettlementDocuments {
  const instructorLogs = input.workLogs.filter((log) => log.instructorId === input.instructor.id);
  const calculation = calculateHealthSupportInstructorManager({
    budget: input.instructor.totalBudget,
    hourlyRate: input.instructor.hourlyRate,
    monthlyInsuranceRate: input.instructor.monthlyInsurance,
    monthlyLimitHours: input.instructor.monthlyHourLimit,
    weeklyLimitHours: input.instructor.weeklyHourLimit,
    weeklyWarningHours: Math.min(14, input.instructor.weeklyHourLimit),
    workLogs: instructorLogs,
  });
  const settlement = calculation.monthlySettlements.find((candidate) => candidate.instructorId === input.instructor.id && candidate.month === input.month);
  const hours = settlement?.hours ?? 0;
  const wages = settlement?.wages ?? 0;
  const insurance = settlement?.insurance ?? 0;
  const spent = settlement?.total ?? 0;
  const rows = calculation.workLogs
    .filter((log) => log.date.slice(0, 7) === input.month)
    .map((log) => ({ date: log.date, weekday: log.weekday, startTime: log.startTime, endTime: log.endTime, hours: log.hours }))
    .sort((left, right) => left.date.localeCompare(right.date) || left.startTime.localeCompare(right.startTime));
  const paymentRows = calculation.workLogs
    .filter((log) => log.date.slice(0, 7) === input.month)
    .map((log) => ({
      date: log.date,
      weekday: log.weekday,
      hours: log.hours,
      note: input.workLogs.find((source) => source.instructorId === input.instructor.id && source.date === log.date && source.startTime === log.startTime && source.endTime === log.endTime)?.note ?? "",
      isoWeekKey: log.isoWeek.key,
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
  const paymentWeeklyTotals = [...new Set(paymentRows.map((row) => row.isoWeekKey))]
    .map((isoWeekKey) => ({ isoWeekKey, hours: Number(paymentRows.filter((row) => row.isoWeekKey === isoWeekKey).reduce((total, row) => total + row.hours, 0).toFixed(2)) }));
  const monthIsoWeekKeys = calculation.workLogs
    .filter((log) => log.date.slice(0, 7) === input.month)
    .map((log) => log.isoWeek.key);
  const monthNumber = Number(input.month.slice(5, 7));
  const attendanceRows = rows.map((row) => ({ date: row.date, weekday: fullWeekday(row.weekday), startTime: row.startTime.slice(0, 5), endTime: row.endTime.slice(0, 5), signature: "" as const, teacherConfirmation: "" as const }));

  return {
    settlement: {
      instructorId: input.instructor.id,
      instructorName: input.instructor.name,
      subject: input.instructor.subject,
      month: input.month,
      hourlyRate: input.instructor.hourlyRate,
      hours,
      wages,
      insurance,
      total: settlement?.total ?? 0,
      monthlyLimitWarning: settlement?.monthlyLimitWarning ?? false,
    },
    paymentStatement: { instructorId: input.instructor.id, month: input.month, instructorName: input.instructor.name, weeklyHours: input.instructor.weeklyHours ?? 0, subject: input.instructor.subject, hourlyRate: input.instructor.hourlyRate, hours, amount: wages, rows: paymentRows, weeklyTotals: paymentWeeklyTotals },
    monthlyWorkDetail: { instructorId: input.instructor.id, month: input.month, rows, totalHours: hours },
    attendanceRegister: {
      title: `출 근 관 리 부 (${monthNumber}월)`,
      field: "학교보건지원강사",
      instructorName: input.instructor.name,
      operationPeriod: operationPeriod(input.instructor.operationStartDate, input.instructor.operationEndDate),
      workDays: attendanceRows.length,
      rows: attendanceRows,
    },
    warnings: settlementWarnings({ calculation, instructor: input.instructor, month: input.month, monthlyHours: hours, monthIsoWeekKeys }),
    budget: {
      total: input.instructor.totalBudget,
      spent,
      remaining: input.instructor.totalBudget - spent,
      status: spent > input.instructor.totalBudget ? "overrun" : "execution",
    },
  };
}

function fullWeekday(shortWeekday: string): string {
  const labels: Readonly<Record<string, string>> = { 일: "일요일", 월: "월요일", 화: "화요일", 수: "수요일", 목: "목요일", 금: "금요일", 토: "토요일" };
  return labels[shortWeekday] ?? shortWeekday;
}

function operationPeriod(startDate: string | undefined, endDate: string | undefined): string {
  if (!startDate || !endDate) return "운영기간 미설정";
  const compact = (date: string) => `‘${date.slice(2, 4)}.${date.slice(5, 7)}.${date.slice(8, 10)}.`;
  return `${compact(startDate)} ~ ${compact(endDate)}`;
}

function settlementWarnings(input: {
  readonly calculation: ReturnType<typeof calculateHealthSupportInstructorManager>;
  readonly instructor: SettlementInstructor;
  readonly month: string;
  readonly monthlyHours: number;
  readonly monthIsoWeekKeys: readonly string[];
}): readonly SettlementWarning[] {
  const weeklyWarnings = input.calculation.weeklyTotals
    .filter((total) => total.instructorId === input.instructor.id && input.monthIsoWeekKeys.includes(total.isoWeekKey) && total.status !== "normal")
    .map((total): SettlementWarning => total.status === "overflow"
      ? { kind: "weeklyLimit", isoWeekKey: total.isoWeekKey, hours: total.hours, limitHours: input.instructor.weeklyHourLimit }
      : { kind: "weeklyWarning", isoWeekKey: total.isoWeekKey, hours: total.hours, warningHours: 14, limitHours: input.instructor.weeklyHourLimit });
  const monthlyWarning: readonly SettlementWarning[] = input.monthlyHours >= input.instructor.monthlyHourLimit
    ? [{ kind: "monthlyLimit", month: input.month, hours: input.monthlyHours, limitHours: input.instructor.monthlyHourLimit }]
    : [];
  return [...weeklyWarnings, ...monthlyWarning];
}
