"use client";

import { useState } from "react";
import { UsersRound } from "lucide-react";

import type { HealthSupportActionState } from "./actions.js";
import { Button } from "./Button.js";
import type { HealthSupportInstructor } from "../core/validation.js";

type SaveInstructor = (state: HealthSupportActionState, formData: FormData) => Promise<HealthSupportActionState>;

function wonLabel(value: number): string {
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value)}원`;
}

function hoursLabel(value: number): string {
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value)}시간`;
}

export function InstructorSettingsForm({ instructor, saveInstructor }: { readonly instructor: HealthSupportInstructor; readonly saveInstructor?: SaveInstructor }) {
  const [formError, setFormError] = useState<string>();
  const [formMessage, setFormMessage] = useState<string>();

  async function submitInstructor(formData: FormData): Promise<void> {
    if (!saveInstructor) {
      setFormError("강사 정보 저장 기능을 준비할 수 없습니다.");
      setFormMessage(undefined);
      return;
    }
    const result = await saveInstructor({ status: "idle" }, formData);
    if (result.status === "error") {
      setFormError(result.message ?? "강사 정보를 확인해 주세요.");
      setFormMessage(undefined);
      return;
    }
    setFormError(undefined);
    setFormMessage(result.message ?? "강사 정보가 저장되었습니다.");
  }

  return <section className="health-support-placeholder" aria-labelledby="health-support-instructor-settings-title"><UsersRound aria-hidden="true" size={22} /><div><h3 id="health-support-instructor-settings-title">강사 운영 설정</h3><p>강사 정보와 운영 기준을 확인하고 수정할 수 있습니다.</p></div><form aria-label="강사 운영 설정" className="health-support-worklog-form" noValidate onSubmit={(event) => { event.preventDefault(); void submitInstructor(new FormData(event.currentTarget)); }}><input name="id" type="hidden" value={instructor.id} /><label>강사명<input defaultValue={instructor.name} name="name" required /></label><label>담당 업무<input defaultValue={instructor.subject} name="subject" required /></label><label>주당 운영 시간<input defaultValue={instructor.weeklyHours} min="0" name="weeklyHours" required step="0.01" type="number" /><small>{hoursLabel(instructor.weeklyHours)}</small></label><label>시간당 단가<input defaultValue={instructor.hourlyRate} min="0" name="hourlyRate" required step="0.01" type="number" /><small>{wonLabel(instructor.hourlyRate)}</small></label><label>월 보험료<input defaultValue={instructor.monthlyInsurance} min="0" name="monthlyInsurance" required step="0.01" type="number" /><small>{wonLabel(instructor.monthlyInsurance)}</small></label><label>월 최대 시간<input defaultValue={instructor.monthlyHourLimit} min="0.01" name="monthlyHourLimit" required step="0.01" type="number" /><small>{hoursLabel(instructor.monthlyHourLimit)}</small></label><label>주 최대 시간<input defaultValue={instructor.weeklyHourLimit} min="0.01" name="weeklyHourLimit" required step="0.01" type="number" /><small>{hoursLabel(instructor.weeklyHourLimit)}</small></label><label>총 예산<input defaultValue={instructor.totalBudget} min="0" name="totalBudget" required step="0.01" type="number" /><small>{wonLabel(instructor.totalBudget)}</small></label><label>운영 시작일<input defaultValue={instructor.operationStartDate} name="operationStartDate" required type="date" /></label><label>운영 종료일<input defaultValue={instructor.operationEndDate} name="operationEndDate" required type="date" /></label>{formError && <p className="form-message is-error" role="alert">{formError}</p>}{formMessage && <p className="form-message" role="status">{formMessage}</p>}<div><Button type="submit">강사 운영 설정 저장</Button></div></form></section>;
}
