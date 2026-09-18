import { z } from "zod";

const activitySchema = z
  .object({
    name: z.string().min(1).max(80),
    teacher: z.string().min(1).max(500),
    student: z.string().min(1).max(500),
    note: z.string().max(300).optional(),
  })
  .strip();

const stageSchema = z
  .object({
    stage: z.enum(["도입", "전개", "정리"]),
    minutes: z.number().int().min(1).max(60),
    leadQuestion: z.string().min(1).max(300).optional(),
    activities: z.array(activitySchema).min(1).max(6),
  })
  .strip();

export const lessonPlanLlmSchema = z
  .object({
    title: z.string().min(1).max(120),
    questionizedObjectives: z.array(z.string().min(1).max(200)).max(5).optional(),
    drivingQuestion: z.string().min(1).max(300).optional(),
    inquiryQuestions: z.array(z.string().min(1).max(200)).max(6).optional(),
    stages: z.array(stageSchema).min(3).max(3),
    assessment: z
      .array(
        z
          .object({
            criteria: z.string().min(1).max(200),
            method: z.string().min(1).max(80),
          })
          .strip()
      )
      .min(1)
      .max(5),
    teacherNotes: z.array(z.string().min(1).max(300)).max(8),
    standards: z.array(z.string().max(32)).max(5).optional(),
  })
  .strip();

export type LessonPlanLlmOutput = z.infer<typeof lessonPlanLlmSchema>;

/** LLM에게 보여 주는 출력 예시 — 실제 JSON 예시 문자열 */
const GENERAL_SHAPE_EXAMPLE = {
  title: "수업 제목",
  stages: [
    {
      stage: "도입|전개|정리",
      minutes: 8,
      activities: [
        { name: "활동명", teacher: "교사 진행·발문", student: "학생 활동", note: "유의" },
      ],
    },
  ],
  assessment: [{ criteria: "평가 기준", method: "관찰|자기평가 등" }],
  teacherNotes: ["지도상 유의점"],
  standards: ["제공된 성취기준 코드만, 없으면 []"],
};

const QUESTION_SHAPE_EXAMPLE = {
  title: "수업 제목",
  questionizedObjectives: ["성취기준을 학생 탐구 문장으로 바꾼 목표"],
  drivingQuestion: "본질 질문 1개",
  inquiryQuestions: ["탐구 하위 질문"],
  stages: [
    {
      stage: "도입|전개|정리",
      minutes: 8,
      leadQuestion: "이 단계를 이끄는 질문",
      activities: [
        {
          name: "활동명",
          teacher: "교실에서 말할 발문 스크립트",
          student: "학생 탐구·증거 활동",
          note: "자료·유의",
        },
      ],
    },
  ],
  assessment: [{ criteria: "과정 중심 평가 기준", method: "관찰|자기성찰|산출물" }],
  teacherNotes: ["오개념·지도 유의"],
  standards: ["제공된 성취기준 코드만, 없으면 []"],
};

export const LESSON_PLAN_JSON_SHAPE_GENERAL = JSON.stringify(
  GENERAL_SHAPE_EXAMPLE,
  null,
  2,
);

export const LESSON_PLAN_JSON_SHAPE_QUESTION = JSON.stringify(
  QUESTION_SHAPE_EXAMPLE,
  null,
  2,
);
