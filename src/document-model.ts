import { GRADE_BANDS } from "./grade-bands.js";
import type {
  LessonPlan,
  LessonPlanActivity,
  LessonPlanStage,
} from "./types.js";

export type DocLines = string[];

export type DocProcessRow = {
  stage: string;
  minutesLabel: string;
  activityLines: DocLines;
  noteLines: DocLines;
};

export type LessonPlanDocumentModel = {
  title: string;
  modeLabel: string;
  subtitle: string;
  grade: string;
  subject: string;
  topic: string;
  standards: string;
  objective?: string;
  questionizedObjectives: string[];
  drivingQuestion?: string;
  inquiryQuestions: string[];
  processRows: DocProcessRow[];
  assessment: Array<{ criteria: string; method: string }>;
  teacherNotes: string[];
};

export function formatGradeLabel(plan: LessonPlan): string {
  const id = plan.curriculum?.gradeBandId;
  if (!id) return "—";
  const band = GRADE_BANDS.find((b) => b.id === id);
  if (!band) return id;
  const level =
    band.schoolLevel === "elementary"
      ? "초등"
      : band.schoolLevel === "middle"
        ? "중등"
        : "고등";
  return `${level} ${band.label}`;
}

/** Same structure as PlanTableView activity cell. */
export function activityLinesFromStage(stage: LessonPlanStage): DocLines {
  const lines: string[] = [];
  for (const a of stage.activities) {
    lines.push(`◦ ${a.name}`);
    if (a.teacher?.trim()) lines.push(`교사: ${a.teacher.trim()}`);
    if (a.student?.trim()) lines.push(`학생: ${a.student.trim()}`);
  }
  return lines.length ? lines : ["—"];
}

/** Same structure as PlanTableView notes cell. */
export function noteLinesFromStage(stage: LessonPlanStage): DocLines {
  const lines: string[] = [];
  if (stage.leadQuestion?.trim()) {
    lines.push(`이끄는 질문: ${stage.leadQuestion.trim()}`);
  }
  for (const a of stage.activities) {
    if (a.note?.trim()) lines.push(`• ${a.note.trim()}`);
  }
  return lines.length ? lines : ["—"];
}

/**
 * Canonical document model shared by:
 * - on-screen PlanTableView
 * - HWPX export
 * - DOCX export
 */
export function buildLessonPlanDocumentModel(
  plan: LessonPlan
): LessonPlanDocumentModel {
  const modeLabel =
    plan.mode === "question-driven" ? "질문이 있는 수업" : "일반 지도안";
  return {
    title: plan.title?.trim() || "수업 지도안",
    modeLabel,
    subtitle: `${modeLabel} 지도안`,
    grade: formatGradeLabel(plan),
    subject: plan.curriculum?.subject?.trim() || "—",
    topic: plan.topic?.trim() || "—",
    standards:
      plan.standards.length > 0 ? plan.standards.join(", ") : "(미선택)",
    objective: plan.objective?.trim() || undefined,
    questionizedObjectives: (plan.questionizedObjectives ?? [])
      .map((x) => x.trim())
      .filter(Boolean),
    drivingQuestion: plan.drivingQuestion?.trim() || undefined,
    inquiryQuestions: (plan.inquiryQuestions ?? [])
      .map((x) => x.trim())
      .filter(Boolean),
    processRows: plan.stages.map((stage) => ({
      stage: stage.stage,
      minutesLabel: `${stage.minutes}분`,
      activityLines: activityLinesFromStage(stage),
      noteLines: noteLinesFromStage(stage),
    })),
    assessment: plan.assessment.map((a) => ({
      criteria: a.criteria?.trim() || "—",
      method: a.method?.trim() || "—",
    })),
    teacherNotes: (plan.teacherNotes ?? []).map((n) => n.trim()).filter(Boolean),
  };
}

export function isLessonPlanLike(value: unknown): value is LessonPlan {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<LessonPlan>;
  return (
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    typeof v.topic === "string" &&
    Array.isArray(v.stages) &&
    Array.isArray(v.assessment)
  );
}
