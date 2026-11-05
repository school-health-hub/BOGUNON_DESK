import { describe, expect, it } from "vitest";

import {
  calculateHealthSupportInstructorManager,
  healthSupportImportIdentity,
  parseHealthSupportWorkLog,
} from "./domain.js";

describe("Health Support Instructor Manager calculation domain", () => {
  it("derives schedule, limits, settlement, budget, and statement without storing calculated fields", () => {
    // Given: one August work log and the manager's configured rates and limits
    const input = {
      budget: 1_000_000,
      hourlyRate: 30_000,
      monthlyInsuranceRate: 100_000,
      monthlyLimitHours: 60,
      weeklyLimitHours: 15,
      weeklyWarningHours: 14,
      workLogs: [{ instructorId: "instructor-a", date: "2026-08-18", startTime: "09:30", endTime: "12:30" }],
    };

    // When: the current inputs are calculated
    const result = calculateHealthSupportInstructorManager(input);

    // Then: every displayed value is derived from the inputs
    expect(result.workLogs).toEqual([{ ...input.workLogs[0], hours: 3, weekday: "\uD654", isoWeek: { key: "2026-W34", range: "2026-08-17 ~ 2026-08-23" } }]);
    expect(result.weeklyTotals).toEqual([{ instructorId: "instructor-a", isoWeekKey: "2026-W34", hours: 3, status: "normal" }]);
    expect(result.monthlySettlements).toEqual([{ instructorId: "instructor-a", month: "2026-08", hours: 3, wages: 90_000, insurance: 100_000, total: 190_000, monthlyLimitWarning: false }]);
    expect(result.paymentStatements).toEqual([{ instructorId: "instructor-a", month: "2026-08", hours: 3, amount: 90_000 }]);
    expect(result.budget).toEqual({ total: 1_000_000, spent: 190_000, remaining: 810_000, status: "execution" });
  });

  it("applies the verified weekly boundary rule and ISO years across a calendar boundary", () => {
    // Given: weekly totals at the expected normal, warning, and inclusive overflow thresholds
    const base = { budget: 1, hourlyRate: 1, monthlyInsuranceRate: 0, monthlyLimitHours: 99 };

    // When: each independently supplied hour total is calculated
    const normal = calculateHealthSupportInstructorManager({ ...base, workLogs: [{ instructorId: "normal", date: "2026-08-17", startTime: "09:00", endTime: "22:59:24" }] });
    const warning = calculateHealthSupportInstructorManager({ ...base, workLogs: [{ instructorId: "warning", date: "2026-08-17", startTime: "09:00", endTime: "23:00" }] });
    const overflow = calculateHealthSupportInstructorManager({ ...base, workLogs: [{ instructorId: "overflow", date: "2026-08-17", startTime: "00:00", endTime: "15:00" }] });
    const boundary = calculateHealthSupportInstructorManager({ ...base, workLogs: [{ instructorId: "boundary", date: "2021-01-01", startTime: "09:00", endTime: "10:00" }] });

    // Then: the Excel boundary is inclusive and ISO weeks retain their ISO year
    expect(normal.weeklyTotals[0]?.status).toBe("normal");
    expect(normal.weeklyTotals[0]?.hours).toBe(13.99);
    expect(warning.weeklyTotals[0]?.status).toBe("warning");
    expect(overflow.weeklyTotals[0]?.status).toBe("overflow");
    expect(boundary.workLogs[0]?.isoWeek).toEqual({ key: "2020-W53", range: "2020-12-28 ~ 2021-01-03" });
  });

  it("preserves whole and half-hour schedules as decimal hours", () => {
    // Given: a two-and-a-half-hour schedule
    const input = { budget: 1, hourlyRate: 10_000, monthlyInsuranceRate: 0, monthlyLimitHours: 60, workLogs: [{ instructorId: "instructor-a", date: "2026-08-18", startTime: "09:30", endTime: "12:00" }] };

    // When: the schedule is calculated
    const result = calculateHealthSupportInstructorManager(input);

    // Then: the decimal hours and statement amount keep the half hour
    expect(result.workLogs[0]?.hours).toBe(2.5);
    expect(result.paymentStatements[0]?.amount).toBe(25_000);
  });

  it("keeps insurance conditional on that instructor having work in the month and flags monthly limits", () => {
    // Given: two instructors, with only one working in an over-limit month
    const result = calculateHealthSupportInstructorManager({
      budget: 500_000,
      hourlyRate: 10_000,
      monthlyInsuranceRate: 50_000,
      monthlyLimitHours: 4,
      weeklyLimitHours: 15,
      weeklyWarningHours: 14,
      workLogs: [
        { instructorId: "active", date: "2026-08-03", startTime: "09:00", endTime: "12:00" },
        { instructorId: "active", date: "2026-08-10", startTime: "09:00", endTime: "12:00" },
      ],
    });

    // When: monthly settlements are calculated
    const active = result.monthlySettlements[0];

    // Then: only the active instructor-month receives insurance and the limit warning is observable
    expect(active).toMatchObject({ instructorId: "active", hours: 6, wages: 60_000, insurance: 50_000, total: 110_000, monthlyLimitWarning: true });
    expect(result.monthlySettlements).toHaveLength(1);
  });

  it("rejects malformed or non-increasing work times at the input boundary", () => {
    // Given: malformed and non-increasing user input
    const malformed = { instructorId: "instructor-a", date: "2026-02-30", startTime: "9:30", endTime: "12:30" };
    const nonIncreasing = { instructorId: "instructor-a", date: "2026-08-18", startTime: "12:30", endTime: "12:30" };

    // When: each value crosses the parser boundary
    const malformedResult = parseHealthSupportWorkLog(malformed);
    const nonIncreasingResult = parseHealthSupportWorkLog(nonIncreasing);

    // Then: no invalid schedule becomes a work log
    expect(malformedResult.success).toBe(false);
    expect(nonIncreasingResult.success).toBe(false);
  });

  it("identifies imports deterministically and recomputes after edited or deleted input sets", () => {
    // Given: an imported work log and a later edited/deleted input set
    const imported = { instructorId: "instructor-a", date: "2026-08-18", startTime: "09:30", endTime: "12:30" };
    const base = { budget: 100_000, hourlyRate: 10_000, monthlyInsuranceRate: 0, monthlyLimitHours: 60, weeklyLimitHours: 15, weeklyWarningHours: 14 };

    // When: the same imported row is identified and each input set is recalculated
    const original = calculateHealthSupportInstructorManager({ ...base, workLogs: [imported] });
    const edited = calculateHealthSupportInstructorManager({ ...base, workLogs: [{ ...imported, endTime: "13:30" }] });
    const deleted = calculateHealthSupportInstructorManager({ ...base, workLogs: [] });

    // Then: identity is stable and stale totals never remain after input changes
    expect(healthSupportImportIdentity(imported)).toBe(healthSupportImportIdentity({ ...imported }));
    expect(original.monthlySettlements[0]?.hours).toBe(3);
    expect(edited.monthlySettlements[0]?.hours).toBe(4);
    expect(deleted.monthlySettlements).toEqual([]);
    expect(deleted.budget).toMatchObject({ spent: 0, remaining: 100_000 });
  });
});
