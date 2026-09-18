import { GRADE_BANDS, getGradeBandsForLevel } from "./grade-bands.js";
import {
  LESSON_PLAN_JSON_SHAPE_GENERAL,
  LESSON_PLAN_JSON_SHAPE_QUESTION,
} from "./schema.js";
import type {
  CurriculumContext,
  LessonPlanMode,
  SchoolLevel,
  StandardRef,
} from "./types.js";

export interface ScaffoldInput {
  topic: string;
  schoolLevel: SchoolLevel;
  subject: string;
  gradeBandId?: string;
  mode?: LessonPlanMode;
  objective?: string;
  classContext?: string;
  standards?: StandardRef[];
  prerequisites?: string[];
  nextTopics?: string[];
}

export interface ScaffoldResult {
  mode: LessonPlanMode;
  curriculum: CurriculumContext;
  jsonShape: string;
  agentGenerationBrief: string;
  pipeline: string[];
}

function resolveGradeBand(schoolLevel: SchoolLevel, gradeBandId?: string) {
  if (gradeBandId) {
    const found = GRADE_BANDS.find((band) => band.id === gradeBandId);
    if (found) return found;
  }
  return getGradeBandsForLevel(schoolLevel)[0];
}

const SCHOOL_LEVEL_LABELS: Record<SchoolLevel, string> = {
  elementary: "초등",
  middle: "중등",
  high: "고등",
};

export function buildScaffold(input: ScaffoldInput): ScaffoldResult {
  const mode: LessonPlanMode = input.mode ?? "question-driven";
  const band = resolveGradeBand(input.schoolLevel, input.gradeBandId);
  const standards = (input.standards ?? []).slice(0, 5);
  const curriculum: CurriculumContext = {
    schoolLevel: input.schoolLevel,
    subject: input.subject,
    gradeBandId: band.id,
    gradePrefix: band.gradePrefix,
    standardRefs: standards,
    prerequisites: (input.prerequisites ?? []).slice(0, 10),
    nextTopics: (input.nextTopics ?? []).slice(0, 10),
  };

  const schoolLabel = SCHOOL_LEVEL_LABELS[input.schoolLevel];
  const lines: string[] = [
    "당신은 한국 초·중·고 교사를 돕는 수업 설계 전문가입니다.",
    "출력은 JSON only. 마크다운 코드펜스 금지. 웹 검색 결과는 사용하지 마세요.",
    "",
  ];

  if (mode === "question-driven") {
    lines.push(
      "모드: 질문이 있는 수업 (2022 개정 — 학생 주도성·깊이 있는 학습·과정 중심 평가)",
      "과정안 작성 파이프라인(반드시 반영):",
      "1) 학습 목표의 질문화(Questionizing) → questionizedObjectives",
      "2) 핵심(본질) 질문 1개 → drivingQuestion",
      "3) 질문 연쇄: 각 stage.leadQuestion + inquiryQuestions",
      "4) 학생 활동·과정 평가 정합",
      "5) teacher 필드는 교실 발문 스크립트(실제 말할 문장)",
      "",
      "규칙:",
      "- 사실형 질문 남용 금지. 본질·탐구·성찰 질문 중심.",
      "- 도입에서 질문 걸기, 전개에서 증거 탐구, 정리에서 질문에 대한 잠정 답+성찰.",
    );
  } else {
    lines.push(
      "모드: 일반 지도안 (성취기준·학습 목표 정합의 표준 40분 과정안)",
      "- 도입(동기·선수) / 전개(핵심 활동 2-3) / 정리(요약·확인)",
      "- teacher 필드는 구체 진행 안내·발문",
    );
  }

  lines.push(
    "",
    "[교육과정 정합 — 인용 전용]",
    "- 학교급: " + schoolLabel + " / 교과: " + input.subject + " / 학년군: " + band.label,
  );

  if (standards.length > 0) {
    lines.push("- 확정 성취기준 (이 목록의 코드만 standards 필드에 사용):");
    for (const s of standards) {
      lines.push("  - [" + s.code + "] 「" + s.text + "」");
    }
  } else {
    lines.push("- 성취기준 미선택: 교과·학년 맥락만으로 설계하고 standards는 [].");
  }

  if (curriculum.prerequisites.length > 0) {
    lines.push("- 선수학습(이미 아는 것으로 가정): " + curriculum.prerequisites.join(", "));
  }
  if (curriculum.nextTopics.length > 0) {
    lines.push("- 범위 밖(다음 차시 예고 정도만): " + curriculum.nextTopics.join(", "));
  }

  lines.push(
    "",
    "인용 규칙:",
    "- 성취기준 코드를 지어내지 마세요. 위 확정 목록에 없는 코드는 standards에서 제외됩니다.",
    "- 학생 활동 문장(student)에는 성취기준 코드·괄호 코드를 넣지 마세요.",
    "",
    "[교사 의도]",
    "- topic: " + input.topic,
    "- objective: " + (input.objective?.trim() || "(미입력)"),
    "- classContext: " + (input.classContext?.trim() || "(미입력)"),
    "",
    "[Minutes] 도입 5-8 / 전개 25-30 / 정리 5-7, 합 약 40분.",
    "",
    "Return exactly:",
    mode === "question-driven"
      ? LESSON_PLAN_JSON_SHAPE_QUESTION
      : LESSON_PLAN_JSON_SHAPE_GENERAL,
  );

  return {
    mode,
    curriculum,
    jsonShape:
      mode === "question-driven"
        ? LESSON_PLAN_JSON_SHAPE_QUESTION
        : LESSON_PLAN_JSON_SHAPE_GENERAL,
    agentGenerationBrief: lines.join("\n"),
    pipeline: [
      "1. agentGenerationBrief대로 지도안 JSON 작성",
      "2. lessonplan_validate로 형식·cite-only 검증",
      "3. lessonplan_render_hwpx로 .hwpx 파일 저장",
    ],
  };
}
