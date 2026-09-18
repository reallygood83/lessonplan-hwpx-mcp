import JSZip from "jszip";
import { markdownToHwpx } from "kordoc";
import {
  buildLessonPlanDocumentModel,
  type LessonPlanDocumentModel,
} from "./document-model.js";
import { assertSupportedKordoc } from "./kordoc-compat.js";
import type { LessonPlan } from "./types.js";

/**
 * Page content width under 쪽 여백 L/R 30mm on A4:
 * 59528 - 2*8504 = 42520 HWPUNIT → tables use 42000 for a safe fit.
 * Process: 단계 8% · 시간 7% · 활동 58% · 유의 27%.
 */
const TABLE_WIDTH = 42000;
const PROCESS_COLS = {
  stage: 3360,
  minutes: 2940,
  activity: 24360,
  notes: 11340,
} as const;
const META_COLS = [5918, 15082, 5918, 15082] as const;
const ASSESS_COLS = [29400, 12600] as const;
/**
 * BorderFill catalog is numbered 1..4 with id == 1-based document position,
 * mirroring real Hangul-authored files (ids always start at 1, contiguous).
 * Hangul resolves borderFillIDRef either by id attribute or by 1-based list
 * position depending on build — id==position makes both resolutions agree.
 */
const DEFAULT_FILL_ID = "1"; // borderless default (paragraph/charPr refs)
const BORDER_ID = "2"; // body/data cells: SOLID grid, no fill
const LABEL_FILL_ID = "3";
const HEADER_FILL_ID = "4";
const LABEL_BG = "#EDF3F1";
const HEADER_BG = "#D9E8E3";

function esc(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tRun(text: string, charPr: string): string {
  return `<hp:run charPrIDRef="${charPr}"><hp:t>${esc(text) || " "}</hp:t></hp:run>`;
}

function p(text: string, paraPr = "0", charPr = "0"): string {
  return `<hp:p paraPrIDRef="${paraPr}" styleIDRef="0">${tRun(text, charPr)}</hp:p>`;
}

function cellParas(lines: string[], charPr: string): string {
  const cleaned = lines.map((l) => String(l ?? "").trim()).filter(Boolean);
  const use = cleaned.length ? cleaned : [" "];
  return use
    .map((line) => `<hp:p paraPrIDRef="0" styleIDRef="0">${tRun(line, charPr)}</hp:p>`)
    .join("");
}

function tc(
  lines: string[],
  col: number,
  row: number,
  width: number,
  height: number,
  opts: { header?: boolean; label?: boolean }
): string {
  const header = Boolean(opts.header);
  const label = Boolean(opts.label);
  const borderId = header ? HEADER_FILL_ID : label ? LABEL_FILL_ID : BORDER_ID;
  const charPr = header || label ? "2" : "0";
  return (
    `<hp:tc name="" header="${header ? "1" : "0"}" hasMargin="0" protect="0" editable="1" dirty="0" borderFillIDRef="${borderId}">` +
    `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="${header || label ? "CENTER" : "TOP"}" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">` +
    cellParas(lines, charPr) +
    `</hp:subList>` +
    `<hp:cellAddr colAddr="${col}" rowAddr="${row}"/>` +
    `<hp:cellSpan colSpan="1" rowSpan="1"/>` +
    `<hp:cellSz width="${width}" height="${height}"/>` +
    `<hp:cellMargin left="120" right="120" top="100" bottom="100"/>` +
    `</hp:tc>`
  );
}

type CellSpec = { lines: string[]; header?: boolean; label?: boolean };

function tbl(rows: CellSpec[][], colWidths: number[]): string {
  const rowCnt = rows.length;
  const colCnt = colWidths.length;
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const heights = rows.map((row) => {
    const maxLines = Math.max(
      1,
      ...row.map((c) => Math.max(1, c.lines.filter((x) => String(x).trim()).length))
    );
    return Math.max(1200, 600 + maxLines * 620);
  });
  const totalH = heights.reduce((a, b) => a + b, 0);
  let body = "";
  rows.forEach((row, r) => {
    body += "<hp:tr>";
    row.forEach((cell, c) => {
      body += tc(cell.lines, c, r, colWidths[c] ?? 10000, heights[r] ?? 1500, {
        header: cell.header,
        label: cell.label,
      });
    });
    body += "</hp:tr>";
  });
  return (
    `<hp:tbl id="${2000 + Math.floor(Math.random() * 7000)}" zOrder="0" numberingType="TABLE" pageBreak="CELL" repeatHeader="1" rowCnt="${rowCnt}" colCnt="${colCnt}" cellSpacing="0" borderFillIDRef="${BORDER_ID}" noShading="0">` +
    `<hp:sz width="${totalW}" widthRelTo="ABSOLUTE" height="${totalH}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" horzAlign="CENTER" vertAlign="TOP" vertOffset="0" horzOffset="0"/>` +
    `<hp:outMargin left="0" right="0" top="0" bottom="0"/>` +
    `<hp:inMargin left="80" right="80" top="80" bottom="80"/>` +
    body +
    `</hp:tbl>`
  );
}

function pTable(tableXml: string): string {
  return `<hp:p paraPrIDRef="0" styleIDRef="0"><hp:run charPrIDRef="0">${tableXml}</hp:run></hp:p>`;
}

/**
 * A4 portrait page setup Hangul actually honors.
 * Root cause: a kordoc-minimal <hp:secPr> (missing id/tabStopVal/lineNumberShape/
 * pageBorderFill and outlineShapeIDRef="0") is ignored on open — Hangul falls
 * back to the "기본" preset (L/R30 T20 B15 H15 F15). Real Hangul-authored files
 * use the richer secPr shape below; with that shape, custom margins stick.
 *
 * Target 쪽 여백 (mm): L/R 30, T/B 10, header 10, footer 15, gutter 0
 * HWPUNIT = mm * 7200 / 25.4 → 8504 / 2835 / 4252
 */
function secPrTitle(title: string): string {
  return (
    `<hp:p id="0" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
    `<hp:run charPrIDRef="5">` +
    `<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">` +
    `<hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/>` +
    `<hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>` +
    `<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>` +
    `<hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>` +
    `<hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY">` +
    `<hp:margin header="2835" footer="4252" gutter="0" left="8504" right="8504" top="2835" bottom="2835"/>` +
    `</hp:pagePr>` +
    `<hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr>` +
    `<hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr>` +
    `<hp:pageBorderFill type="BOTH" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER">` +
    `<hp:offset left="1417" right="1417" top="1417" bottom="1417"/>` +
    `</hp:pageBorderFill>` +
    `</hp:secPr>` +
    `<hp:t>${esc(title)}</hp:t></hp:run></hp:p>`
  );
}


function buildSectionFromModel(doc: LessonPlanDocumentModel): string {
  const parts: string[] = [];
  parts.push(secPrTitle(doc.title));
  parts.push(p(doc.subtitle));
  parts.push(p(" "));

  parts.push(
    pTable(
      tbl(
        [
          [
            { lines: ["학년/군"], label: true },
            { lines: [doc.grade] },
            { lines: ["교과"], label: true },
            { lines: [doc.subject] },
          ],
          [
            { lines: ["주제"], label: true },
            { lines: [doc.topic] },
            { lines: ["성취기준"], label: true },
            { lines: [doc.standards] },
          ],
        ],
        [...META_COLS]
      )
    )
  );
  parts.push(p(" "));

  if (doc.objective) {
    parts.push(p("학습 목표", "0", "2"));
    parts.push(p(doc.objective));
    parts.push(p(" "));
  }

  if (doc.questionizedObjectives.length) {
    parts.push(p("질문화된 학습 목표", "0", "2"));
    for (const o of doc.questionizedObjectives) parts.push(p(`· ${o}`));
    parts.push(p(" "));
  }

  if (doc.drivingQuestion) {
    parts.push(p("본질 질문", "0", "2"));
    parts.push(p(doc.drivingQuestion));
    parts.push(p(" "));
  }

  if (doc.inquiryQuestions.length) {
    parts.push(p("탐구 질문", "0", "2"));
    for (const q of doc.inquiryQuestions) parts.push(p(`· ${q}`));
    parts.push(p(" "));
  }

  parts.push(p("교수·학습 과정", "0", "2"));
  parts.push(
    pTable(
      tbl(
        [
          [
            { lines: ["단계"], header: true },
            { lines: ["시간"], header: true },
            { lines: ["교수·학습 활동"], header: true },
            { lines: ["자료 및 유의점"], header: true },
          ],
          ...doc.processRows.map((row) => [
            { lines: [row.stage] },
            { lines: [row.minutesLabel] },
            { lines: row.activityLines },
            { lines: row.noteLines },
          ]),
        ],
        [
          PROCESS_COLS.stage,
          PROCESS_COLS.minutes,
          PROCESS_COLS.activity,
          PROCESS_COLS.notes,
        ]
      )
    )
  );
  parts.push(p(" "));

  parts.push(p("평가", "0", "2"));
  parts.push(
    pTable(
      tbl(
        [
          [
            { lines: ["평가 기준"], header: true },
            { lines: ["평가 방법"], header: true },
          ],
          ...doc.assessment.map((a) => [
            { lines: [a.criteria] },
            { lines: [a.method] },
          ]),
        ],
        [...ASSESS_COLS]
      )
    )
  );

  if (doc.teacherNotes.length) {
    parts.push(p(" "));
    parts.push(p("지도상 유의점", "0", "2"));
    for (const n of doc.teacherNotes) parts.push(p(`· ${n}`));
  }

  parts.push(p(" "));

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n` +
    `<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core">\n` +
    parts.join("\n") +
    `\n</hs:sec>`
  );
}

/**
 * Root cause (screenshot + kordoc + real-Hangul diff, 2026-08-07):
 * Our catalog was 0-based ([id0 empty, id1 empty, id2 SOLID…]) while every
 * real Hangul file numbers borderFills 1..N. When Hangul resolves
 * borderFillIDRef by 1-based list position, ref="2" landed on the SECOND
 * element (an empty fill) — body grid vanished while refs 3/4 happened to hit
 * SOLID entries (the header/label boxes in the screenshots). The catalog is
 * now contiguous 1..4 with id == position, so id-resolution and
 * position-resolution pick the same SOLID fill for every cell.
 */
function noneBorderFillXml(id: string): string {
  return (
    `<hh:borderFill id="${id}" threeD="0" shadow="0" centerLine="0" breakCellSeparateLine="0">` +
    `<hh:slash type="NONE" Crooked="0" isCounter="0"/>` +
    `<hh:backSlash type="NONE" Crooked="0" isCounter="0"/>` +
    `<hh:leftBorder type="NONE" width="0.1 mm" color="#000000"/>` +
    `<hh:rightBorder type="NONE" width="0.1 mm" color="#000000"/>` +
    `<hh:topBorder type="NONE" width="0.1 mm" color="#000000"/>` +
    `<hh:bottomBorder type="NONE" width="0.1 mm" color="#000000"/>` +
    `<hh:diagonal type="NONE" width="0.1 mm" color="#000000"/>` +
    `<hh:fillInfo/>` +
    `</hh:borderFill>`
  );
}

function kordocSolidBorderFillXml(id: string): string {
  return (
    `<hh:borderFill id="${id}" threeD="0" shadow="0" centerLine="0" breakCellSeparateLine="0">` +
    `<hh:slash type="NONE" Crooked="0" isCounter="0"/>` +
    `<hh:backSlash type="NONE" Crooked="0" isCounter="0"/>` +
    `<hh:leftBorder type="SOLID" width="0.25 mm" color="#000000"/>` +
    `<hh:rightBorder type="SOLID" width="0.25 mm" color="#000000"/>` +
    `<hh:topBorder type="SOLID" width="0.25 mm" color="#000000"/>` +
    `<hh:bottomBorder type="SOLID" width="0.25 mm" color="#000000"/>` +
    `<hh:diagonal type="NONE" width="0.1 mm" color="#000000"/>` +
    `<hh:fillInfo/>` +
    `</hh:borderFill>`
  );
}

function filledSolidBorderFillXml(id: string, faceColor: string): string {
  return (
    `<hh:borderFill id="${id}" threeD="0" shadow="0" centerLine="0" breakCellSeparateLine="0">` +
    `<hh:slash type="NONE" Crooked="0" isCounter="0"/>` +
    `<hh:backSlash type="NONE" Crooked="0" isCounter="0"/>` +
    `<hh:leftBorder type="SOLID" width="0.25 mm" color="#000000"/>` +
    `<hh:rightBorder type="SOLID" width="0.25 mm" color="#000000"/>` +
    `<hh:topBorder type="SOLID" width="0.25 mm" color="#000000"/>` +
    `<hh:bottomBorder type="SOLID" width="0.25 mm" color="#000000"/>` +
    `<hh:diagonal type="NONE" width="0.1 mm" color="#000000"/>` +
    `<hc:fillBrush><hc:winBrush faceColor="${faceColor}" hatchColor="#000000" alpha="0"/></hc:fillBrush>` +
    `</hh:borderFill>`
  );
}

function injectBorders(headerXml: string): string {
  let xml = headerXml;
  if (!xml.includes("xmlns:hc=")) {
    xml = xml.replace(
      /<hh:head\b([^>]*)>/,
      `<hh:head$1 xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core">`
    );
  }

  const catalog =
    `<hh:borderFills itemCnt="4">` +
    noneBorderFillXml(DEFAULT_FILL_ID) +
    kordocSolidBorderFillXml(BORDER_ID) +
    filledSolidBorderFillXml(LABEL_FILL_ID, LABEL_BG) +
    filledSolidBorderFillXml(HEADER_FILL_ID, HEADER_BG) +
    `</hh:borderFills>`;

  if (!/<hh:borderFills[\s\S]*?<\/hh:borderFills>/.test(xml)) {
    throw new Error("HWPX shell header.xml missing hh:borderFills");
  }
  xml = xml.replace(/<hh:borderFills[\s\S]*?<\/hh:borderFills>/, catalog);

  // The kordoc shell references borderFill 0 from charPr/paraPr; the catalog
  // is 1-based now, so point those at the borderless default (id=1).
  xml = xml.replace(/borderFillIDRef="0"/g, `borderFillIDRef="${DEFAULT_FILL_ID}"`);

  if (/fillInfo type="COLOR"/.test(xml)) {
    throw new Error("Refusing to emit fillInfo type=COLOR borderFill");
  }

  // id must equal 1-based position so both ref-resolution strategies agree.
  const ids = [...xml.matchAll(/<hh:borderFill id="(\d+)"/g)].map((m) => m[1]);
  ids.forEach((id, i) => {
    if (Number(id) !== i + 1) {
      throw new Error(`borderFill id=${id} at position ${i + 1} (id must equal 1-based position)`);
    }
  });

  const bf2 = xml.match(new RegExp(`<hh:borderFill id="${BORDER_ID}"[\\s\\S]*?</hh:borderFill>`))?.[0] || "";
  if (!/leftBorder type="SOLID"[^>]*#000000/.test(bf2) || !bf2.includes("<hh:fillInfo/>")) {
    throw new Error(`borderFill id=${BORDER_ID} must be kordoc SOLID + empty fillInfo`);
  }

  return xml;
}

export async function buildLessonPlanHwpx(plan: LessonPlan): Promise<Buffer> {
  assertSupportedKordoc();
  const doc = buildLessonPlanDocumentModel(plan);
  const shell = await markdownToHwpx("#\n");
  const shellZip = await JSZip.loadAsync(shell);
  const header = injectBorders(
    await shellZip.file("Contents/header.xml")!.async("string")
  );
  const section = buildSectionFromModel(doc);
  const preview = [doc.title, doc.topic, doc.drivingQuestion || ""]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1000);
  const container = await shellZip.file("META-INF/container.xml")!.async("string");
  const contentHpf = await shellZip.file("Contents/content.hpf")!.async("string");

  const out = new JSZip();
  out.file("mimetype", "application/hwp+zip", { compression: "STORE" });
  out.file("META-INF/container.xml", container);
  out.file("Contents/content.hpf", contentHpf);
  out.file("Contents/header.xml", header);
  out.file("Contents/section0.xml", section);
  out.file("Preview/PrvText.txt", preview);

  return Buffer.from(
    await out.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })
  );
}
