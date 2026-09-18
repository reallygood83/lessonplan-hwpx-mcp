#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lib = await import(join(root, "dist/lib.js"));

function parseFlags(argv) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "-o" || a === "--out") flags.out = argv[++i];
    else if (a === "--name") flags.name = argv[++i];
    else if (a === "--level") flags.level = argv[++i];
    else if (a === "--subject") flags.subject = argv[++i];
    else if (a === "--band") flags.band = argv[++i];
    else if (a === "--mode") flags.mode = argv[++i];
    else if (a === "--topic") flags.topic = argv[++i];
    else pos.push(a);
  }
  return { flags, pos };
}

function slugify(title) {
  const base = String(title)
    .replace(/[^\w가-힣一-龥ぁ-んァ-ン -]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return base || "lesson-plan";
}

function outDir(flags) {
  return resolve(flags.out ?? process.env.LESSONPLAN_OUT_DIR ?? join(homedir(), "Downloads"));
}

async function writeHwpx(plan, meta, flags) {
  const validation = lib.validateLessonPlanJson(plan, {
    mode: meta.mode ?? "question-driven",
    curriculum: meta.curriculum ?? null,
  });
  if (!validation.ok) {
    console.error("검증 실패:", JSON.stringify(validation.issues, null, 2));
    process.exit(1);
  }
  const lessonPlan = lib.toLessonPlan(validation.data, {
    topic: meta.topic,
    objective: meta.objective,
    mode: meta.mode ?? "question-driven",
    curriculum: meta.curriculum ?? null,
  });
  const buffer = await lib.buildLessonPlanHwpx(lessonPlan);
  const dir = outDir(flags);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, slugify(flags.name ?? lessonPlan.title) + ".hwpx");
  writeFileSync(path, buffer);
  console.log(path);
}

const { flags, pos } = parseFlags(process.argv.slice(2));
const cmd = pos[0];

if (cmd === "scaffold") {
  const topic = pos[1];
  if (!topic || !flags.level || !flags.subject) {
    console.error('사용법: lessonplan-hwpx scaffold "<주제>" --level elementary --subject 수학 [--mode general] [--band elem-5-6]');
    process.exit(2);
  }
  const result = lib.buildScaffold({
    topic,
    schoolLevel: flags.level,
    subject: flags.subject,
    gradeBandId: flags.band,
    mode: flags.mode,
  });
  console.log(JSON.stringify(result, null, 2));
} else if (cmd === "render") {
  const file = pos[1];
  if (!file || !flags.topic) {
    console.error('사용법: lessonplan-hwpx render plan.json --topic "<주제>" [--mode question-driven] [-o 폴더] [--name 파일명]');
    process.exit(2);
  }
  const plan = JSON.parse(readFileSync(file, "utf8"));
  await writeHwpx(plan, { topic: flags.topic, mode: flags.mode }, flags);
} else if (cmd === "demo") {
  const { DEMO_PLAN, DEMO_CURRICULUM } = await import(join(root, "scripts/demo-plan.mjs"));
  await writeHwpx(DEMO_PLAN, { topic: "민주주의 삼권분립", mode: "question-driven", curriculum: DEMO_CURRICULUM }, flags);
} else {
  console.log("지도안 HWPX 커넥터 CLI");
  console.log("");
  console.log('  scaffold "<주제>" --level elementary --subject 수학   생성 브리프 출력');
  console.log('  render plan.json --topic "<주제>" [-o 폴더]          .hwpx 저장');
  console.log("  demo [-o 폴더]                                       샘플 지도안 저장");
  process.exit(cmd ? 2 : 0);
}
