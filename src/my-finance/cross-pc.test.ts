import { expect, it } from "vitest";
import fixture from "./fixtures/cross-pc-synthetic.json";
import { createIncomeRecord, summarizeIncome, type IncomeDraft } from "./domain";

it("matches annual totals for the native school → home → school fixture across serialization/restart", () => {
  const school = fixture.schoolIncome.map((entry) => createIncomeRecord(entry as IncomeDraft));
  const initial = summarizeIncome(school, 2026);
  expect(initial).toEqual({ year: 2026, recordCount: 2, grossKrw: 1_200_000, deductionsKrw: 39_000, netKrw: 1_161_000, unpaidCount: 1 });
  const home = JSON.parse(JSON.stringify(school)) as typeof school;
  home[1] = createIncomeRecord(fixture.homeUpdate as IncomeDraft);
  home.push(createIncomeRecord(fixture.homeCreate as IncomeDraft));
  const reopenedSchool = JSON.parse(JSON.stringify(home)) as typeof home;
  expect(reopenedSchool).toEqual(home);
  expect(summarizeIncome(home, 2026)).toEqual(fixture.expectedAnnual);
  expect(summarizeIncome(reopenedSchool, 2026)).toEqual(fixture.expectedAnnual);
});
