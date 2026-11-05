import { z } from "zod";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const weekdayLabels = ["\uC77C", "\uC6D4", "\uD654", "\uC218", "\uBAA9", "\uAE08", "\uD1A0"] as const;

function isCalendarDate(value: string): boolean {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function secondsFromTime(value: string): number {
  const [hourText, minuteText, secondText = "0"] = value.split(":");
  return Number(hourText) * 3_600 + Number(minuteText) * 60 + Number(secondText);
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isCalendarDate, "Invalid calendar date");
const timeSchema = z.string().regex(timePattern, "Time must use HH:mm or HH:mm:ss");

export const healthSupportWorkLogSchema = z.object({
  instructorId: z.string().trim().min(1),
  date: dateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
}).refine((log) => secondsFromTime(log.startTime) < secondsFromTime(log.endTime), {
  message: "End time must be after start time",
  path: ["endTime"],
});

export const healthSupportInstructorManagerInputSchema = z.object({
  budget: z.number().finite().nonnegative().default(0),
  hourlyRate: z.number().finite().nonnegative().default(0),
  monthlyInsuranceRate: z.number().finite().nonnegative().default(0),
  monthlyLimitHours: z.number().finite().positive().default(60),
  weeklyLimitHours: z.number().finite().positive().default(15),
  weeklyWarningHours: z.number().finite().nonnegative().default(14),
  workLogs: z.array(healthSupportWorkLogSchema).default([]),
}).refine((input) => input.weeklyWarningHours <= input.weeklyLimitHours, {
  message: "Weekly warning hours cannot exceed the weekly limit",
  path: ["weeklyWarningHours"],
});

export type HealthSupportWorkLogInput = z.input<typeof healthSupportWorkLogSchema>;
export type HealthSupportInstructorManagerInput = z.input<typeof healthSupportInstructorManagerInputSchema>;
type HealthSupportWorkLog = z.output<typeof healthSupportWorkLogSchema>;
type HealthSupportInput = z.output<typeof healthSupportInstructorManagerInputSchema>;

type IsoWeek = { readonly key: string; readonly range: string };
type DerivedWorkLog = HealthSupportWorkLog & { readonly hours: number; readonly weekday: string; readonly isoWeek: IsoWeek };
type WeeklyStatus = "normal" | "warning" | "overflow";
type WeeklyTotal = { readonly instructorId: string; readonly isoWeekKey: string; readonly hours: number; readonly status: WeeklyStatus };
type MonthlySettlement = { readonly instructorId: string; readonly month: string; readonly hours: number; readonly wages: number; readonly insurance: number; readonly total: number; readonly monthlyLimitWarning: boolean };
type PaymentStatement = { readonly instructorId: string; readonly month: string; readonly hours: number; readonly amount: number };
type BudgetSummary = { readonly total: number; readonly spent: number; readonly remaining: number; readonly status: "execution" | "overrun" };

export type HealthSupportInstructorManagerCalculation = {
  readonly workLogs: readonly DerivedWorkLog[];
  readonly weeklyTotals: readonly WeeklyTotal[];
  readonly monthlySettlements: readonly MonthlySettlement[];
  readonly paymentStatements: readonly PaymentStatement[];
  readonly budget: BudgetSummary;
};

function roundedHours(seconds: number): number {
  return Number((seconds / 3_600).toFixed(2));
}

function isoWeekFor(dateText: string): IsoWeek {
  const date = new Date(`${dateText}T00:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - weekday);
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const isoYear = thursday.getUTCFullYear();
  const januaryFourth = new Date(Date.UTC(isoYear, 0, 4));
  const firstMonday = new Date(januaryFourth);
  firstMonday.setUTCDate(januaryFourth.getUTCDate() - ((januaryFourth.getUTCDay() + 6) % 7));
  const week = Math.round((monday.getTime() - firstMonday.getTime()) / 604_800_000) + 1;
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { key: `${isoYear}-W${String(week).padStart(2, "0")}`, range: `${formatDate(monday)} ~ ${formatDate(sunday)}` };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function weekdayFor(dateText: string): string {
  const label = weekdayLabels[new Date(`${dateText}T00:00:00Z`).getUTCDay()];
  return label ?? "";
}

function totalByKey<T>(items: readonly T[], keyFor: (item: T) => string, hoursFor: (item: T) => number): ReadonlyMap<string, number> {
  const totals = new Map<string, number>();
  for (const item of items) {
    const key = keyFor(item);
    totals.set(key, roundedHours((totals.get(key) ?? 0) * 3_600 + hoursFor(item) * 3_600));
  }
  return totals;
}

function weeklyStatus(hours: number, input: HealthSupportInput): WeeklyStatus {
  if (hours >= input.weeklyLimitHours) return "overflow";
  if (hours >= input.weeklyWarningHours) return "warning";
  return "normal";
}

export function parseHealthSupportWorkLog(input: unknown) {
  return healthSupportWorkLogSchema.safeParse(input);
}

export function healthSupportImportIdentity(input: HealthSupportWorkLogInput): string {
  const log = healthSupportWorkLogSchema.parse(input);
  return JSON.stringify([log.instructorId, log.date, log.startTime, log.endTime]);
}

export function calculateHealthSupportInstructorManager(input: HealthSupportInstructorManagerInput): HealthSupportInstructorManagerCalculation {
  const parsed = healthSupportInstructorManagerInputSchema.parse(input);
  const workLogs = parsed.workLogs.map((log): DerivedWorkLog => ({
    ...log,
    hours: roundedHours(secondsFromTime(log.endTime) - secondsFromTime(log.startTime)),
    weekday: weekdayFor(log.date),
    isoWeek: isoWeekFor(log.date),
  }));
  const weeklyHours = totalByKey(workLogs, (log) => `${log.instructorId}|${log.isoWeek.key}`, (log) => log.hours);
  const monthlyHours = totalByKey(workLogs, (log) => `${log.instructorId}|${log.date.slice(0, 7)}`, (log) => log.hours);
  const weeklyTotals = [...weeklyHours].map(([key, hours]) => {
    const [instructorId, isoWeekKey] = key.split("|");
    return { instructorId: instructorId ?? "", isoWeekKey: isoWeekKey ?? "", hours, status: weeklyStatus(hours, parsed) };
  }).sort((left, right) => left.instructorId.localeCompare(right.instructorId) || left.isoWeekKey.localeCompare(right.isoWeekKey));
  const monthlySettlements = [...monthlyHours].map(([key, hours]) => {
    const [instructorId, month] = key.split("|");
    const wages = Math.round(hours * parsed.hourlyRate);
    const insurance = parsed.monthlyInsuranceRate;
    return { instructorId: instructorId ?? "", month: month ?? "", hours, wages, insurance, total: wages + insurance, monthlyLimitWarning: hours >= parsed.monthlyLimitHours };
  }).sort((left, right) => left.instructorId.localeCompare(right.instructorId) || left.month.localeCompare(right.month));
  const paymentStatements = monthlySettlements.map(({ instructorId, month, hours, wages }) => ({ instructorId, month, hours, amount: wages }));
  const spent = monthlySettlements.reduce((sum, settlement) => sum + settlement.total, 0);
  return { workLogs, weeklyTotals, monthlySettlements, paymentStatements, budget: { total: parsed.budget, spent, remaining: parsed.budget - spent, status: spent > parsed.budget ? "overrun" : "execution" } };
}
