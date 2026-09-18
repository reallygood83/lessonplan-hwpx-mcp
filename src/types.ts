export type SchoolLevel = "elementary" | "middle" | "high";

export type GradeBand = {
  schoolLevel: SchoolLevel;
  id: string;
  label: string;
  gradePrefix: string;
};

/** 확정(confirmed)된 성취기준 — cu2022-mcp 검색 결과 등 신뢰 소스에서 온 code/text 쌍 */
export type StandardRef = {
  code: string;
  text: string;
};

export type CurriculumContext = {
  schoolLevel: SchoolLevel;
  subject: string;
  gradeBandId: string;
  gradePrefix: string;
  /** 인용 전용: 모델은 여기 있는 코드만 standards 필드에 쓸 수 있다 */
  standardRefs: StandardRef[];
  prerequisites: string[];
  nextTopics: string[];
};

export type LessonPlanMode = "general" | "question-driven";

export type LessonPlanStageName = "도입" | "전개" | "정리";

export type LessonPlanActivity = {
  name: string;
  teacher: string;
  student: string;
  note?: string;
};

export type LessonPlanStage = {
  stage: LessonPlanStageName;
  minutes: number;
  /** 질문이 있는 수업: 이 단계를 이끄는 질문 */
  leadQuestion?: string;
  activities: LessonPlanActivity[];
};

export type LessonPlanAssessment = {
  criteria: string;
  method: string;
};

export type LessonPlan = {
  id: string;
  title: string;
  topic: string;
  objective: string;
  mode: LessonPlanMode;
  curriculum: CurriculumContext | null;
  /** 질문화된 학습 목표 (질문 모드) */
  questionizedObjectives?: string[];
  drivingQuestion?: string;
  inquiryQuestions?: string[];
  stages: LessonPlanStage[];
  assessment: LessonPlanAssessment[];
  teacherNotes: string[];
  /** standardRefs 안의 confirmed 코드만 — 0개 허용 */
  standards: string[];
  meta: {
    model?: string;
    createdAt: string;
    updatedAt: string;
  };
};
