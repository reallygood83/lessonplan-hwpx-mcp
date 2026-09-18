import { randomUUID } from "node:crypto";
import { lessonPlanLlmSchema, type LessonPlanLlmOutput } from "./schema.js";
import type {
  CurriculumContext,
  LessonPlan,
  LessonPlanMode,
  LessonPlanStageName,
} from "./types.js";

export interface ValidationIssue {
  path: string;
  message: string;
  severity: "error" | "warn";
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  data?: LessonPlanLlmOutput;
}

const REQUIRED_STAGES: LessonPlanStageName[] = ["도입", "전개", "정리"];

export function validateLessonPlanJson(
  input: unknown,
  opts: { mode?: LessonPlanMode; curriculum?: CurriculumContext | null } = {},
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const parsed = lessonPlanLlmSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
        severity: "error",
      });
    }
    return { ok: false, issues };
  }

  const data = parsed.data;

  for (const name of REQUIRED_STAGES) {
    if (!data.stages.some((s) => s.stage === name)) {
      issues.push({
        path: "stages",
        message: "필수 단계 누락: " + name,
        severity: "error",
      });
    }
  }

  if (opts.mode === "question-driven" && !data.drivingQuestion?.trim()) {
    issues.push({
      path: "drivingQuestion",
      message: "질문이 있는 수업 모드에는 본질 질문(drivingQuestion)이 필요합니다.",
      severity: "error",
    });
  }

  const totalMinutes = data.stages.reduce((sum, s) => sum + s.minutes, 0);
  if (totalMinutes < 25 || totalMinutes > 80) {
    issues.push({
      path: "stages.minutes",
      message: "전체 시수가 " + totalMinutes + "분입니다 (권장 25–80분).",
      severity: "warn",
    });
  }

  const allowed = new Set(
    (opts.curriculum?.standardRefs ?? []).map((r) => r.code),
  );
  if (allowed.size > 0) {
    for (const code of data.standards ?? []) {
      if (!allowed.has(code)) {
        issues.push({
          path: "standards",
          message: "확정 목록에 없는 성취기준 코드(cite-only 위반): " + code,
          severity: "error",
        });
      }
    }
  }

  return {
    ok: !issues.some((i) => i.severity === "error"),
    issues,
    data,
  };
}

/** 검증 통과한 LLM 출력 + 맥락 → 렌더용 LessonPlan */
export function toLessonPlan(
  data: LessonPlanLlmOutput,
  meta: {
    topic: string;
    objective?: string;
    mode: LessonPlanMode;
    curriculum: CurriculumContext | null;
    model?: string;
  },
): LessonPlan {
  const allowed = new Set(
    (meta.curriculum?.standardRefs ?? []).map((r) => r.code),
  );
  const standards = (data.standards ?? []).filter(
    (code) => allowed.size === 0 || allowed.has(code),
  );
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    title: data.title.trim(),
    topic: meta.topic,
    objective: meta.objective?.trim() ?? "",
    mode: meta.mode,
    curriculum: meta.curriculum,
    questionizedObjectives: data.questionizedObjectives
      ?.map((q) => q.trim())
      .filter(Boolean),
    drivingQuestion: data.drivingQuestion?.trim(),
    inquiryQuestions: data.inquiryQuestions?.map((q) => q.trim()).filter(Boolean),
    stages: data.stages,
    assessment: data.assessment,
    teacherNotes: data.teacherNotes,
    standards,
    meta: { model: meta.model, createdAt: now, updatedAt: now },
  };
}
