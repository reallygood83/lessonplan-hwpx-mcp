import type { GradeBand, SchoolLevel } from "./types.js";

export const SCHOOL_LEVELS = ["elementary", "middle", "high"] as const;

export const GRADE_BANDS = [
  {
    schoolLevel: "elementary",
    id: "elem-1-2",
    label: "1–2학년",
    gradePrefix: "2",
  },
  {
    schoolLevel: "elementary",
    id: "elem-3-4",
    label: "3–4학년",
    gradePrefix: "4",
  },
  {
    schoolLevel: "elementary",
    id: "elem-5-6",
    label: "5–6학년",
    gradePrefix: "6",
  },
  // 중등 성취기준 코드는 모두 접두 "9". UI는 학년을 나누되 코드 필터는 "9"로 통일.
  {
    schoolLevel: "middle",
    id: "mid-1",
    label: "1학년",
    gradePrefix: "9",
  },
  {
    schoolLevel: "middle",
    id: "mid-2",
    label: "2학년",
    gradePrefix: "9",
  },
  {
    schoolLevel: "middle",
    id: "mid-3",
    label: "3학년",
    gradePrefix: "9",
  },
  {
    schoolLevel: "high",
    id: "high-1",
    label: "1학년",
    gradePrefix: "10",
  },
  {
    schoolLevel: "high",
    id: "high-2-3",
    label: "2–3학년·선택",
    gradePrefix: "12",
  },
] as const satisfies readonly GradeBand[];

export function isSchoolLevel(value: string | null): value is SchoolLevel {
  return SCHOOL_LEVELS.some((schoolLevel) => schoolLevel === value);
}

export function getGradeBandsForLevel(schoolLevel: SchoolLevel) {
  return GRADE_BANDS.filter((band) => band.schoolLevel === schoolLevel);
}
