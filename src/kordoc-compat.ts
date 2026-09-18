import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

function resolveKordocVersion(): string {
  let dir = dirname(require.resolve("kordoc"));
  for (;;) {
    const candidate = join(dir, "package.json");
    if (existsSync(candidate)) {
      const pkg = JSON.parse(readFileSync(candidate, "utf8")) as {
        name?: string;
        version?: string;
      };
      if (pkg.name === "kordoc" && pkg.version) return pkg.version;
    }
    const parent = dirname(dir);
    if (parent === dir) return "unknown";
    dir = parent;
  }
}

export const KORDOC_VERSION: string = resolveKordocVersion();

/**
 * build-hwpx는 kordoc이 만드는 빈 HWPX 껍데기의 내부 구조(header.xml의
 * borderFills 카탈로그, content.hpf, container.xml)에 의존한다.
 * 검증된 메이저 버전(3=studyfold 실전, 4=npm 최신) 외에는 조기에 실패시킨다.
 * 세부 구조 무결성은 QA 스모크가 shell/헤더 단언으로 한 번 더 잠근다.
 */
export function assertSupportedKordoc(): void {
  const major = Number(KORDOC_VERSION.split(".")[0]);
  if (major !== 3 && major !== 4) {
    throw new Error(
      "지원하지 않는 kordoc 버전입니다: " +
        KORDOC_VERSION +
        " (지원: 3.x, 4.x). QA 스모크로 껍데기 구조를 검증한 뒤 목록에 추가하세요.",
    );
  }
}
