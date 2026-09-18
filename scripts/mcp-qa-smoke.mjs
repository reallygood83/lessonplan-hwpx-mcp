#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { DEMO_PLAN, DEMO_CURRICULUM } from "./demo-plan.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = mkdtempSync(join(tmpdir(), "lessonplan-hwpx-qa-"));

const transport = new StdioClientTransport({
  command: "node",
  args: [join(root, "dist/index.js")],
  cwd: root,
});
const client = new Client({ name: "lessonplan-hwpx-qa", version: "1.0.0" });
await client.connect(transport);

async function call(name, args = {}) {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content?.map((c) => c.text || "").join("\n") || "";
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  if (res.isError) throw new Error(name + " error: " + text.slice(0, 300));
  return data;
}

const checks = [];
const pass = (name, cond, detail = "") => {
  checks.push({ name, pass: !!cond, detail });
  if (!cond) console.error("FAIL", name, detail);
  else console.log("PASS", name, detail);
};

const tools = await client.listTools();
const names = tools.tools.map((t) => t.name);
pass("tool_count_3", names.length === 3, names.join(","));

const scaffold = await call("lessonplan_scaffold", {
  topic: "5학년 분수의 나눗셈",
  schoolLevel: "elementary",
  subject: "수학",
  gradeBandId: "elem-5-6",
  mode: "general",
  standards: [
    { code: "6수01-06", text: "분수의 나눗셈의 계산 원리를 탐구하고 계산할 수 있다." },
  ],
});
pass(
  "scaffold_general_shape",
  typeof scaffold.jsonShape === "string" && scaffold.agentGenerationBrief.includes("인용 전용"),
  "brief+shape",
);
pass(
  "scaffold_standards_embedded",
  scaffold.agentGenerationBrief.includes("6수01-06") &&
    scaffold.agentGenerationBrief.includes("분수의 나눗셈의 계산 원리"),
  "cite-only block",
);

const scaffoldQ = await call("lessonplan_scaffold", {
  topic: "민주주의 삼권분립",
  schoolLevel: "elementary",
  subject: "사회",
});
pass(
  "scaffold_question_brief",
  scaffoldQ.mode === "question-driven" && scaffoldQ.agentGenerationBrief.includes("본질 질문"),
  "question-driven default",
);

const valid = await call("lessonplan_validate", {
  plan: DEMO_PLAN,
  mode: "question-driven",
  curriculum: DEMO_CURRICULUM,
});
pass("validate_accepts_demo", valid.ok === true, String(valid.issues?.length ?? 0) + " issues");

const noDriving = JSON.parse(JSON.stringify(DEMO_PLAN));
delete noDriving.drivingQuestion;
const flagged = await call("lessonplan_validate", {
  plan: noDriving,
  mode: "question-driven",
  curriculum: DEMO_CURRICULUM,
});
pass("validate_flags_missing_driving_question", flagged.ok === false, "drivingQuestion");

const fakeStandard = JSON.parse(JSON.stringify(DEMO_PLAN));
fakeStandard.standards = ["6수01-99"];
const withRefs = { ...DEMO_CURRICULUM, standardRefs: [{ code: "6사03-08", text: "법의 의미와 역할" }] };
const citeCheck = await call("lessonplan_validate", {
  plan: fakeStandard,
  mode: "question-driven",
  curriculum: withRefs,
});
pass("validate_blocks_fake_standard", citeCheck.ok === false, "6수01-99 blocked");

const rendered = await call("lessonplan_render_hwpx", {
  plan: DEMO_PLAN,
  topic: "민주주의 삼권분립",
  mode: "question-driven",
  curriculum: DEMO_CURRICULUM,
  outputDir: out,
});
pass(
  "render_writes_file",
  rendered.ok === true && existsSync(rendered.path) && rendered.bytes > 4000,
  rendered.fileName + " " + rendered.bytes + "B",
);

const zip = await JSZip.loadAsync(readFileSync(rendered.path));
const names_in_zip = Object.keys(zip.files);
pass(
  "render_zip_structure",
  ["mimetype", "META-INF/container.xml", "Contents/content.hpf", "Contents/header.xml", "Contents/section0.xml"].every((f) =>
    names_in_zip.includes(f),
  ),
  names_in_zip.length + " entries",
);

const section = await zip.file("Contents/section0.xml").async("string");
const header = await zip.file("Contents/header.xml").async("string");
const phrases = [
  "권력 집중 상황 체험하기",
  "만약 우리 반 반장이 혼자서 규칙도 만들고",
  "이끄는 질문: 권력이 한곳에 모이면?",
  "본질 질문",
  "교수·학습 과정",
];
const tblCount = (section.match(/<hp:tbl /g) || []).length;
pass(
  "render_section_content",
  phrases.every((ph) => section.includes(ph)) && !section.includes("<br") && tblCount >= 3,
  tblCount + " tables",
);

const catalog = header.match(/<hh:borderFills[\s\S]*?<\/hh:borderFills>/)?.[0] || "";
const fills = [...catalog.matchAll(/<hh:borderFill id="(\d+)"[\s\S]*?<\/hh:borderFill>/g)];
const itemCnt = Number(catalog.match(/itemCnt="(\d+)"/)?.[1]);
const idEqualsPosition = fills.every((f, i) => Number(f[1]) === i + 1);
const bodyFill = fills.find((f) => f[1] === "2")?.[0] || "";
const solidOk =
  ["leftBorder", "rightBorder", "topBorder", "bottomBorder"].every((side) =>
    new RegExp("<hh:" + side + ' type="SOLID" width="0\\.25 mm" color="#000000"/>').test(bodyFill),
  ) && !/fillInfo type="COLOR"/.test(header);
pass(
  "borderfill_integrity",
  fills.length > 0 && itemCnt === fills.length && idEqualsPosition && solidOk,
  fills.length + " fills",
);

const badPlan = JSON.parse(JSON.stringify(DEMO_PLAN));
badPlan.stages = badPlan.stages.filter((s) => s.stage !== "정리");
const rejected = await call("lessonplan_render_hwpx", {
  plan: badPlan,
  topic: "민주주의 삼권분립",
  mode: "question-driven",
  outputDir: out,
});
pass("render_rejects_invalid", rejected.ok === false, "missing 정리 blocked");

await client.close();

const cli = spawnSync("node", [join(root, "scripts/render-cli.mjs"), "demo", "-o", out], {
  cwd: root,
  encoding: "utf8",
});
pass(
  "cli_demo_render",
  cli.status === 0 && cli.stdout.trim().endsWith(".hwpx") && existsSync(cli.stdout.trim()),
  cli.stdout.trim() || cli.stderr.slice(0, 120),
);

const passed = checks.filter((c) => c.pass).length;
const scorePct = Math.round((passed / checks.length) * 100);
const report = {
  generatedAt: new Date().toISOString(),
  version: "0.1.0",
  scorePct,
  pass: passed === checks.length,
  passed,
  total: checks.length,
  checks,
  tools: names,
};
mkdirSync(join(root, "qa"), { recursive: true });
writeFileSync(join(root, "qa/mcp-tool-matrix.json"), JSON.stringify(report, null, 2));
writeFileSync(
  join(root, "qa/mcp-qa-artifact.md"),
  "# lessonplan-hwpx-mcp QA (지도안 HWPX 커넥터)\n\npass: **" +
    report.pass +
    "** · score: **" +
    scorePct +
    "점** (" +
    passed +
    "/" +
    checks.length +
    ")\n\n" +
    checks.map((c) => "- [" + (c.pass ? "PASS" : "FAIL") + "] " + c.name + " " + (c.detail || "")).join("\n") +
    "\n",
);

console.log("QA SCORE", scorePct, "(" + passed + "/" + checks.length + ")");
if (!report.pass) process.exit(1);
