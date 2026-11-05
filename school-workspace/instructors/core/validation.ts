import { z } from "zod";

import { parseHealthSupportWorkLog } from "./domain.js";

function isCalendarDate(value: string): boolean {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function nonnegativeDecimal(maximum: number) {
  return z.number().finite().min(0).max(maximum).refine((value) => Number(value.toFixed(2)) === value, "Must use at most two decimal places");
}

function positiveDecimal(maximum: number) {
  return nonnegativeDecimal(maximum).refine((value) => value > 0, "Must be greater than zero");
}

const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isCalendarDate, "Invalid calendar date");
const instructorIdSchema = z.string().uuid();
const weeklyHoursSchema = nonnegativeDecimal(168), hourlyRateSchema = nonnegativeDecimal(9_999_999_999.99), monthlyInsuranceSchema = nonnegativeDecimal(9_999_999_999.99);
const monthlyHourLimitSchema = positiveDecimal(744), weeklyHourLimitSchema = positiveDecimal(168), totalBudgetSchema = nonnegativeDecimal(999_999_999_999.99);

const instructorInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(160),
  weeklyHours: weeklyHoursSchema,
  hourlyRate: hourlyRateSchema,
  monthlyInsurance: monthlyInsuranceSchema,
  monthlyHourLimit: monthlyHourLimitSchema,
  weeklyHourLimit: weeklyHourLimitSchema,
  totalBudget: totalBudgetSchema,
  operationStartDate: calendarDateSchema,
  operationEndDate: calendarDateSchema,
}).refine((values) => values.operationStartDate <= values.operationEndDate, {
  message: "Operation end date must not be before its start date",
  path: ["operationEndDate"],
});

const workLogNoteSchema = z.string().trim().max(2_000).nullable();

export type HealthSupportInstructorInput = z.output<typeof instructorInputSchema>;
export type HealthSupportInstructor = HealthSupportInstructorInput & { readonly id: string };
export type HealthSupportWorkLogMutation = z.output<typeof parseHealthSupportWorkLogMutationSchema>;
export type HealthSupportWorkLog = HealthSupportWorkLogMutation & { readonly id: string };
export type HealthSupportWorkLogDraft = HealthSupportWorkLogMutation;

const parseHealthSupportWorkLogMutationSchema = z.object({
  instructorId: instructorIdSchema,
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  note: workLogNoteSchema,
}).superRefine((values, context) => {
  const parsed = parseHealthSupportWorkLog(values);
  if (parsed.success) return;
  for (const issue of parsed.error.issues) {
    context.addIssue({ code: "custom", message: issue.message, path: issue.path });
  }
});


export const parseHealthSupportInstructorInput = (input: unknown) => instructorInputSchema.parse(input);
export const parseHealthSupportWorkLogMutation = (input: unknown) => parseHealthSupportWorkLogMutationSchema.parse(input);
