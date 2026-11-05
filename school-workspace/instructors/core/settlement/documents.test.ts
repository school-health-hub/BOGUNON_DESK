import { describe, expect, it } from "vitest";

import { createHealthSupportSettlementDocuments } from "./documents.js";
import { sanitizedMonthlyReconciliation } from "./reconciliation-fixtures.js";

describe("health support settlement documents", () => {
  it("reconciles two sanitized representative months from shared work logs", () => {
    // Given: aggregate-safe synthetic work records for two representative months
    const input = {
      instructor: {
        id: "instructor-1",
        name: "Instructor A",
        subject: "Health support",
        hourlyRate: 30_000,
        monthlyInsurance: 45_000,
        monthlyHourLimit: 60,
        weeklyHourLimit: 15,
        totalBudget: 500_000,
      },
      workLogs: [
        { instructorId: "instructor-1", date: "2026-08-03", startTime: "09:00", endTime: "12:00" },
        { instructorId: "instructor-1", date: "2026-08-04", startTime: "09:00", endTime: "11:30" },
        { instructorId: "instructor-1", date: "2026-09-07", startTime: "09:00", endTime: "13:00" },
      ],
    };

    // When: August and September documents are calculated from the same logs
    const august = createHealthSupportSettlementDocuments({ ...input, month: "2026-08" });
    const september = createHealthSupportSettlementDocuments({ ...input, month: "2026-09" });

    // Then: each month reconciles hours, wage, active-month insurance, total spend, and budget
    expect(august.settlement).toMatchObject(sanitizedMonthlyReconciliation[0]);
    expect(september.settlement).toMatchObject(sanitizedMonthlyReconciliation[1]);
    expect(august.budget).toEqual({ total: 500_000, spent: 210_000, remaining: 290_000, status: "execution" });
    expect(september.budget).toEqual({ total: 500_000, spent: 165_000, remaining: 335_000, status: "execution" });
  });

  it("keeps insurance out of the payment statement", () => {
    // Given: a month with wages and an active-month insurance charge
    const input = settlementInput();

    // When: the payment statement view model is created
    const documents = createHealthSupportSettlementDocuments({ ...input, month: "2026-08" });

    // Then: the statement amount is hourly wage times hours only
    expect(documents.paymentStatement).toEqual({
      instructorId: "instructor-1",
      month: "2026-08",
      instructorName: "Instructor A",
      weeklyHours: 0,
      subject: "Health support",
      hourlyRate: 30_000,
      hours: 3,
      amount: 90_000,
      rows: [{ date: "2026-08-03", weekday: "월", hours: 3, note: "", isoWeekKey: "2026-W32" }],
      weeklyTotals: [{ isoWeekKey: "2026-W32", hours: 3 }],
    });
    expect(documents.settlement.insurance).toBe(45_000);
  });

  it("surfaces weekly and monthly limit warnings alongside monthly detail rows", () => {
    // Given: one selected month with an overflowing week and monthly limit
    const input = {
      ...settlementInput(),
      instructor: { ...settlementInput().instructor, monthlyHourLimit: 14, weeklyHourLimit: 15 },
      workLogs: [
        { instructorId: "instructor-1", date: "2026-08-03", startTime: "09:00", endTime: "16:00" },
        { instructorId: "instructor-1", date: "2026-08-04", startTime: "09:00", endTime: "17:00" },
      ],
    };

    // When: monthly document view props are created
    const documents = createHealthSupportSettlementDocuments({ ...input, month: "2026-08" });

    // Then: warnings and source-derived work detail remain visible without a monthly clone
    expect(documents.warnings).toEqual([
      { kind: "weeklyLimit", isoWeekKey: "2026-W32", hours: 15, limitHours: 15 },
      { kind: "monthlyLimit", month: "2026-08", hours: 15, limitHours: 14 },
    ]);
    expect(documents.monthlyWorkDetail.rows).toEqual([
      { date: "2026-08-03", weekday: "월", startTime: "09:00", endTime: "16:00", hours: 7 },
      { date: "2026-08-04", weekday: "화", startTime: "09:00", endTime: "17:00", hours: 8 },
    ]);
  });

  it("does not charge insurance or produce a statement amount for an inactive month", () => {
    // Given: shared logs that contain no work for the selected month
    const input = settlementInput();

    // When: an inactive month is selected
    const documents = createHealthSupportSettlementDocuments({ ...input, month: "2026-09" });

    // Then: settlement and statement safely remain zero
    expect(documents.settlement).toMatchObject({ hours: 0, wages: 0, insurance: 0, total: 0 });
    expect(documents.paymentStatement.amount).toBe(0);
    expect(documents.monthlyWorkDetail.rows).toEqual([]);
  });

  it("uses only the selected instructor's shared logs and budget", () => {
    // Given: shared workspace logs for the selected instructor and another instructor
    const input = settlementInput();
    const workLogs = [
      ...input.workLogs,
      { instructorId: "instructor-2", date: "2026-08-03", startTime: "09:00", endTime: "19:00" },
    ];

    // When: selected instructor documents are created from the shared log collection
    const documents = createHealthSupportSettlementDocuments({ ...input, month: "2026-08", workLogs });

    // Then: unrelated logs do not affect the document or its instructor-specific budget
    expect(documents.settlement.hours).toBe(3);
    expect(documents.budget).toMatchObject({ spent: 135_000, remaining: 365_000 });
  });

  it("shows weekly warnings only when their week is represented in the selected month", () => {
    // Given: an overflowing July week and a normal August work log
    const input = {
      ...settlementInput(),
      workLogs: [
        { instructorId: "instructor-1", date: "2026-07-06", startTime: "09:00", endTime: "16:00" },
        { instructorId: "instructor-1", date: "2026-07-07", startTime: "09:00", endTime: "17:00" },
        { instructorId: "instructor-1", date: "2026-08-03", startTime: "09:00", endTime: "12:00" },
      ],
    };

    // When: an August document is requested
    const documents = createHealthSupportSettlementDocuments({ ...input, month: "2026-08" });

    // Then: the July weekly limit warning does not leak into the August document
    expect(documents.warnings).toEqual([]);
  });

  it("derives an attendance register from the selected month's source logs", () => {
    const input = {
      ...settlementInput(),
      instructor: { ...settlementInput().instructor, operationStartDate: "2026-03-01", operationEndDate: "2026-12-31" },
      workLogs: [
        { instructorId: "instructor-1", date: "2026-06-02", startTime: "09:30", endTime: "12:30" },
        { instructorId: "instructor-1", date: "2026-06-01", startTime: "09:00", endTime: "12:00" },
      ],
    };

    const documents = createHealthSupportSettlementDocuments({ ...input, month: "2026-06" });

    expect(documents.attendanceRegister).toMatchObject({
      title: "출 근 관 리 부 (6월)",
      field: "학교보건지원강사",
      instructorName: "Instructor A",
      operationPeriod: "‘26.03.01. ~ ‘26.12.31.",
      workDays: 2,
    });
    expect(documents.attendanceRegister.rows).toEqual([
      { date: "2026-06-01", weekday: "월요일", startTime: "09:00", endTime: "12:00", signature: "", teacherConfirmation: "" },
      { date: "2026-06-02", weekday: "화요일", startTime: "09:30", endTime: "12:30", signature: "", teacherConfirmation: "" },
    ]);
  });

  it("keeps an empty attendance month printable only as a zero-row document", () => {
    const documents = createHealthSupportSettlementDocuments({ ...settlementInput(), month: "2026-06" });

    expect(documents.attendanceRegister.workDays).toBe(0);
    expect(documents.attendanceRegister.rows).toEqual([]);
  });

  it("supports a full twenty-day attendance month without cloning source records", () => {
    const workLogs = Array.from({ length: 20 }, (_, index) => ({
      instructorId: "instructor-1",
      date: `2026-06-${String(index + 1).padStart(2, "0")}`,
      startTime: "09:00",
      endTime: "12:00",
    }));
    const documents = createHealthSupportSettlementDocuments({ ...settlementInput(), month: "2026-06", workLogs });

    expect(documents.attendanceRegister.workDays).toBe(20);
    expect(documents.attendanceRegister.rows).toHaveLength(20);
    expect(documents.attendanceRegister.rows[0]?.date).toBe("2026-06-01");
    expect(documents.attendanceRegister.rows[19]?.date).toBe("2026-06-20");
  });

  it("reproduces the supplied June statement totals from twenty source logs", () => {
    const entries: readonly [string, string, string][] = [
      ["01", "09:00", "12:00"], ["02", "09:00", "12:00"], ["05", "09:00", "12:00"],
      ["08", "09:00", "12:00"], ["09", "09:00", "12:00"], ["10", "09:30", "12:00"], ["11", "09:00", "13:00"], ["12", "09:00", "11:00"],
      ["15", "09:00", "12:00"], ["16", "09:00", "12:00"], ["17", "09:00", "12:00"], ["18", "09:00", "12:00"], ["19", "09:00", "11:00"],
      ["22", "09:00", "11:00"], ["23", "09:00", "11:00"], ["24", "09:00", "11:00"], ["25", "09:00", "13:00"], ["26", "09:00", "13:30"], ["29", "09:00", "12:00"], ["30", "09:00", "12:00"],
    ];
    const input = { ...settlementInput(), instructor: { ...settlementInput().instructor, hourlyRate: 25_000 }, workLogs: entries.map(([day, startTime, endTime]) => ({ instructorId: "instructor-1", date: `2026-06-${day}`, startTime, endTime })) };
    const documents = createHealthSupportSettlementDocuments({ ...input, month: "2026-06" });

    expect(documents.paymentStatement.rows).toHaveLength(20);
    expect(documents.paymentStatement.hours).toBe(58);
    expect(documents.paymentStatement.amount).toBe(1_450_000);
    expect(documents.paymentStatement.weeklyTotals.map((total) => total.hours)).toEqual([9, 14.5, 14, 14.5, 6]);
    expect(documents.attendanceRegister.rows.map((row) => row.date)).toEqual(documents.paymentStatement.rows.map((row) => row.date));
  });
});

function settlementInput() {
  return {
    instructor: {
      id: "instructor-1",
      name: "Instructor A",
      subject: "Health support",
      hourlyRate: 30_000,
      monthlyInsurance: 45_000,
      monthlyHourLimit: 60,
      weeklyHourLimit: 15,
      totalBudget: 500_000,
    },
    workLogs: [{ instructorId: "instructor-1", date: "2026-08-03", startTime: "09:00", endTime: "12:00" }],
  };
}
