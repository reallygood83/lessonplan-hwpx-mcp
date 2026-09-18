#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { buildLessonPlanHwpx } from "./build-hwpx.js";
import { buildScaffold } from "./scaffold.js";
import { toLessonPlan, validateLessonPlanJson } from "./validate.js";
import { KORDOC_VERSION } from "./kordoc-compat.js";

const server = new McpServer({
  name: "lessonplan-hwpx-mcp",
  version: "0.1.0",
});

function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

const schoolLevelSchema = z
  .enum(["elementary", "middle", "high"])
  .describe("학교급");

const modeSchema = z
  .enum(["general", "question-driven"])
  .optional()
  .describe("지도안 모드 (기본 question-driven)");

const standardRefSchema = z
  .object({
    code: z.string().max(32).describe("성취기준 코드 예: 6수01-06"),
    text: z.string().max(300).describe("성취기준 원문"),
  })
  .strip();

const curriculumSchema = z
  .object({
    schoolLevel: schoolLevelSchema,
    subject: z.string().min(1).max(40),
    gradeBandId: z.string().min(1),
    standardRefs: z.array(standardRefSchema).max(5),
  })
  .strip();

function slugify(title: string): string {
  const base = title
    .replace(/[^\w가-힣一-龥ぁ-んァ-ン -]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return base || "lesson-plan";
}

server.tool(
  "lessonplan_scaffold",
  "주제·학교급·확정 성취기준으로 지도안 작성용 골격과 생성 브리프를 만듭니다. 모델은 브리프대로 JSON을 채운 뒤 lessonplan_validate → lessonplan_render_hwpx 순서로 보내세요. 성취기준은 cu2022-mcp curriculum_search 결과처럼 신뢰 가능한 소스의 code/text만 넣으세요.",
  {
    topic: z.string().min(2).max(200).describe("수업 주제 예: 5학년 분수의 나눗셈"),
    schoolLevel: schoolLevelSchema,
    subject: z.string().min(1).max(40).describe("교과 예: 수학, 국어, 사회"),
    gradeBandId: z
      .string()
      .optional()
      .describe("학년군 id 예: elem-5-6, mid-2, high-2-3 (기본: 해당 학교급 첫 밴드)"),
    mode: modeSchema,
    objective: z.string().max(500).optional().describe("학습 목표 (교사 의도)"),
    classContext: z.string().max(500).optional().describe("학급 맥락 예: 부진 학생 3명"),
    standards: z
      .array(standardRefSchema)
      .max(5)
      .optional()
      .describe("확정 성취기준 code/text — cite-only 대상"),
    prerequisites: z.array(z.string().max(40)).max(10).optional(),
    nextTopics: z.array(z.string().max(40)).max(10).optional(),
  },
  async (input) => jsonResult(buildScaffold(input)),
);

server.tool(
  "lessonplan_validate",
  "작성된 지도안 JSON을 검증합니다: 형식(zod), 도입·전개·정리 필수 단계, 질문이 있는 수업 모드의 본질 질문, cite-only(확정 목록 밖 성취기준 코드 차단).",
  {
    plan: z.unknown().describe("lessonplan_scaffold의 jsonShape대로 채운 지도안 JSON"),
    mode: modeSchema,
    curriculum: curriculumSchema
      .optional()
      .describe("scaffold가 돌려준 curriculum을 그대로 전달하면 cite-only 검증 활성화"),
  },
  async ({ plan, mode, curriculum }) => {
    const ctx = curriculum
      ? {
          ...curriculum,
          gradePrefix: "",
          prerequisites: [],
          nextTopics: [],
        }
      : null;
    const result = validateLessonPlanJson(plan, { mode, curriculum: ctx });
    return jsonResult(result);
  },
);

server.tool(
  "lessonplan_render_hwpx",
  "검증 통과한 지도안 JSON을 한컴 호환 .hwpx 파일로 저장합니다. 표 서식(단계·시간·활동·유의점)은 studyfold 제출용 품질 빌더와 동일합니다. 출력은 .hwpx이며 레거시 .hwp 바이너리 신규 생성은 지원하지 않습니다(한컴에서 다른 이름으로 저장).",
  {
    plan: z.unknown().describe("lessonplan_validate를 통과한 지도안 JSON"),
    topic: z.string().min(2).max(200).describe("수업 주제"),
    mode: modeSchema,
    objective: z.string().max(500).optional(),
    curriculum: curriculumSchema.optional(),
    outputDir: z
      .string()
      .optional()
      .describe("저장 폴더 (기본: LESSONPLAN_OUT_DIR 또는 ~/Downloads)"),
    fileName: z.string().max(80).optional().describe("파일명 (확장자 제외, 기본: 제목 slug)"),
  },
  async ({ plan, topic, mode, objective, curriculum, outputDir, fileName }) => {
    const resolvedMode = mode ?? "question-driven";
    const ctx = curriculum
      ? {
          ...curriculum,
          gradePrefix: "",
          prerequisites: [],
          nextTopics: [],
        }
      : null;
    const validation = validateLessonPlanJson(plan, {
      mode: resolvedMode,
      curriculum: ctx,
    });
    if (!validation.ok || !validation.data) {
      return jsonResult({ ok: false, issues: validation.issues });
    }
    const lessonPlan = toLessonPlan(validation.data, {
      topic,
      objective,
      mode: resolvedMode,
      curriculum: ctx,
    });
    const buffer = await buildLessonPlanHwpx(lessonPlan);
    const dir = resolve(
      outputDir ?? process.env.LESSONPLAN_OUT_DIR ?? join(homedir(), "Downloads"),
    );
    mkdirSync(dir, { recursive: true });
    const base = slugify(fileName ?? lessonPlan.title);
    const path = join(dir, base + ".hwpx");
    writeFileSync(path, buffer);
    return jsonResult({
      ok: true,
      path,
      fileName: base + ".hwpx",
      bytes: buffer.length,
      kordoc: KORDOC_VERSION,
      note: ".hwp 변환은 한컴에서 '다른 이름으로 저장'을 사용하세요.",
    });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
