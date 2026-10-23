import type { CategoryId, CheckResult } from "../types.js";

export interface CheckDef {
  readonly id: string;
  readonly category: CategoryId;
  readonly label: string;
  readonly maxPoints: number;
  readonly why: string;
}

const round = (n: number) => Math.round(n * 10) / 10;

export const scored = (def: CheckDef, points: number, evidence: string, fix: string): CheckResult => {
  const earned = round(Math.max(0, Math.min(points, def.maxPoints)));
  const status = earned >= def.maxPoints ? "pass" : earned > 0 ? "partial" : "fail";
  return { ...def, points: earned, status, evidence, fix: status === "pass" ? null : fix };
};

export const passFail = (def: CheckDef, ok: boolean, evidence: string, fix: string) =>
  scored(def, ok ? def.maxPoints : 0, evidence, fix);

export const notApplicable = (def: CheckDef, reason: string): CheckResult => ({
  ...def,
  points: def.maxPoints,
  status: "na",
  evidence: `Not applicable: ${reason}`,
  fix: null,
});
