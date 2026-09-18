# 지도안 HWPX 커넥터 · lessonplan-hwpx-mcp

**2022 개정 성취기준에 정합한 수업 지도안을 한컴 `.hwpx` 파일로 저장하는 MCP 서버**

> cu2022-mcp(성취기준 cite-only 검색)의 결과를 받아, studyfold(마이클S) 실전 검증된 제출용 표 서식 그대로 지도안 문서를 만듭니다.
> 서버 자체는 LLM을 호출하지 않습니다 — Claude·Grok·Codex 어떤 모델이든 브리프대로 JSON만 채우면 됩니다.

[![MCP](https://img.shields.io/badge/MCP-stdio-blue)](https://modelcontextprotocol.io)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

| | |
|--|--|
| **공식 명칭** | `lessonplan-hwpx-mcp` |
| **한글 표기** | **지도안 HWPX 커넥터** |
| **역할** | 성취기준 정합 지도안 JSON → 검증(cite-only) → `.hwpx` 저장 |
| **짝 MCP** | `cu2022-mcp` (성취기준 검색·인용) — 별도 리포 |
| **CLI** | `lessonplan-hwpx` (터미널 → HWPX) |

---

## 파이프라인

1. `cu2022-mcp`의 `curriculum_search` → 확정 성취기준 `code`/`text` 획득
2. `lessonplan_scaffold` → 지도안 골격 + 생성 브리프
3. 모델(Claude / Grok / GPT 무관)이 브리프대로 지도안 JSON 작성
4. `lessonplan_validate` → 형식·필수 단계·cite-only 검증
5. `lessonplan_render_hwpx` → `.hwpx` 파일 저장 (studyfold 제출용 표 서식)

---

## 도구 (3)

| Tool | 용도 |
|------|------|
| `lessonplan_scaffold` | 주제·학교급·확정 성취기준 → 지도안 골격 + `agentGenerationBrief` (**핵심**) |
| `lessonplan_validate` | 형식(zod)·도입/전개/정리·본질 질문·cite-only(목록 밖 코드 차단) 검증 |
| `lessonplan_render_hwpx` | 검증 통과 JSON → 한컴 호환 `.hwpx` 저장 |

지원 모드: `question-driven`(질문이 있는 수업, 기본) · `general`(일반 지도안)

---

## 설치

```bash
git clone https://github.com/reallygood83/lessonplan-hwpx-mcp.git
cd lessonplan-hwpx-mcp
npm install
npm run build
```

### MCP 클라이언트 설정

```json
{
  "mcpServers": {
    "lessonplan-hwpx": {
      "command": "node",
      "args": ["/absolute/path/to/lessonplan-hwpx-mcp/dist/index.js"]
    }
  }
}
```

| 클라이언트 | 방법 |
|------------|------|
| Claude Code | `claude mcp add lessonplan-hwpx -- node /abs/path/dist/index.js` |
| Codex | `config.toml`에 `[mcp_servers.lessonplan-hwpx]` + command/args |
| Cursor | Settings → MCP |
| Grok Build/CLI | `grok mcp add lessonplan-hwpx -- node /abs/path/dist/index.js` 또는 `~/.grok/config.toml`의 `mcp_servers` |

---

## Grok 봇 연동 (모델 중립 설계)

이 서버는 특정 모델에 종속되지 않습니다. Grok에서 쓰는 3가지 경로:

1. **stdio MCP** — Grok Build/CLI에 위 설정으로 등록하면 도구가 그대로 노출됩니다.
2. **xAI API function calling** — `schemas/xai-tools.json`의 함수 정의를 등록하고, 호출이 오면 로컬에서 이 패키지로 실행합니다. 지도안 JSON 계약은 `schemas/plan.schema.json` 참조.
3. **순수 라이브러리/CLI** — MCP 없이 Node 봇에서 직접:

```js
import { buildScaffold, validateLessonPlanJson, toLessonPlan, buildLessonPlanHwpx } from "lessonplan-hwpx-mcp/lib";

const scaffold = buildScaffold({ topic: "5학년 분수의 나눗셈", schoolLevel: "elementary", subject: "수학", standards: [{ code: "6수01-06", text: "..." }] });
// Grok에게 scaffold.agentGenerationBrief를 보내 지도안 JSON을 받은 뒤
const check = validateLessonPlanJson(grokPlanJson, { mode: "question-driven", curriculum: scaffold.curriculum });
if (check.ok) {
  const plan = toLessonPlan(check.data, { topic: "5학년 분수의 나눗셈", mode: "question-driven", curriculum: scaffold.curriculum });
  const buffer = await buildLessonPlanHwpx(plan); // → 파일로 저장
}
```

```bash
# 셸만 쓸 수 있는 봇이라면
lessonplan-hwpx scaffold "분수의 나눗셈" --level elementary --subject 수학
lessonplan-hwpx render plan.json --topic "분수의 나눗셈" -o ~/Downloads
```

---

## 형식 현실

| 형식 | 지원 | 비고 |
|------|------|------|
| **`.hwpx`** | ✅ | kordoc 껍데기 + 전용 표 빌더 — **권장 납품 형식** |
| **`.hwp` 바이너리 신규 생성** | ⚠️ | kordoc/rhwp 오픈 경로 **미지원** (파싱·패치만). 한컴에서 HWPX → HWP 재저장 |

kordoc 버전 가드: 지원 메이저(3.x·4.x) 외 버전은 렌더 시 조기 실패합니다.

---

## 품질

studyfold에서 한컴 실제 파일과 diff하며 고정한 함정들을 테스트로 잠갔습니다:
- borderFill 1-based id == position (아니면 한컴이 표 그리드를 빈 채움으로 해석)
- A4 쪽 여백이 적용되는 완전한 `secPr` 형태
- 셀 다중 문단(`<br>` 문자 노출 방지), SOLID 0.25mm 표 경계, 헤더/라벨 음영

```bash
npm run qa:smoke   # stdio MCP 12개 체크 — qa/mcp-tool-matrix.json에 점수 기록
```

---

## 설계 원칙

1. **Cite-only** — 성취기준 코드는 확정 목록만. 목록 밖 코드는 validate/render가 차단.
2. **모델 중립** — 서버는 LLM을 호출하지 않음. Grok·Claude·GPT 어디서든 동일 계약.
3. **결정론적 렌더** — 같은 JSON이면 같은 `.hwpx`.
4. **교사 최종 책임** — 보조 도구. 학교 배정표·고시 원문과 대조할 것.
5. **개인정보 금지** — 학생 실명·성적·상담 내용을 넣지 말 것.

## License

MIT © reallygood83
