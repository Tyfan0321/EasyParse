export interface FoldRegion {
  startLine: number;
  closeLine: number;
  containerKind: "object" | "array";
  childCount: number;
  hasTrailingComma: boolean;
}

export interface VisibleLine {
  originalIndex: number;
  text: string;
  foldable: boolean;
  folded: boolean;
}

export function computeFoldRegions(lines: string[]): FoldRegion[] {
  const regions: FoldRegion[] = [];
  const stack: { startLine: number; indent: number; kind: "object" | "array" }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimEnd();

    if (trimmed.endsWith("{")) {
      stack.push({ startLine: i, indent: lines[i].length - lines[i].trimStart().length, kind: "object" });
    } else if (trimmed.endsWith("[")) {
      stack.push({ startLine: i, indent: lines[i].length - lines[i].trimStart().length, kind: "array" });
    }

    const content = trimmed.replace(/,\s*$/, "");
    if (content.endsWith("}") || content.endsWith("]")) {
      const closingChar = content.slice(-1);
      const expectedKind = closingChar === "}" ? "object" : "array";
      if (
        stack.length > 0 &&
        stack[stack.length - 1].kind === expectedKind &&
        stack[stack.length - 1].startLine !== i
      ) {
        const open = stack.pop()!;
        const hasTrailingComma = trimmed !== content;
        const childIndent = open.indent + 2;
        let childCount = 0;
        for (let j = open.startLine + 1; j < i; j++) {
          const cIndent = lines[j].length - lines[j].trimStart().length;
          if (cIndent !== childIndent) continue;
          const ct = lines[j].trimStart();
          if (!ct.startsWith("}") && !ct.startsWith("]")) childCount++;
        }
        regions.push({
          startLine: open.startLine,
          closeLine: i,
          containerKind: open.kind,
          childCount,
          hasTrailingComma,
        });
      }
    }
  }

  return regions;
}

export function buildVisibleLines(lines: string[], regions: FoldRegion[], folded: Set<number>): VisibleLine[] {
  const regionByStart = new Map(regions.map((r) => [r.startLine, r]));
  const foldableSet = new Set(regions.map((r) => r.startLine));
  const result: VisibleLine[] = [];

  let i = 0;
  while (i < lines.length) {
    const region = regionByStart.get(i);
    const isFolded = folded.has(i);

    if (isFolded && region) {
      result.push({
        originalIndex: i,
        text: buildSummary(lines[i], region),
        foldable: true,
        folded: true,
      });
      i = region.closeLine + 1;
    } else {
      result.push({
        originalIndex: i,
        text: lines[i],
        foldable: foldableSet.has(i),
        folded: false,
      });
      i++;
    }
  }

  return result;
}

function buildSummary(openLine: string, region: FoldRegion): string {
  const { containerKind, childCount, hasTrailingComma } = region;
  const closeBracket = containerKind === "object" ? "}" : "]";
  const label =
    containerKind === "object"
      ? `${childCount} key${childCount === 1 ? "" : "s"}`
      : `${childCount} item${childCount === 1 ? "" : "s"}`;
  const comma = hasTrailingComma ? "," : "";
  return `${openLine} /* ${label} */ ${closeBracket}${comma}`;
}

export function buildFoldedPreview(visibleLines: VisibleLine[], maxLen: number): string {
  const lines: string[] = [];
  let len = 0;
  for (const vl of visibleLines) {
    const numStr = String(vl.originalIndex + 1).padStart(4, " ");
    const chevron = vl.foldable ? (vl.folded ? ">" : "v") : " ";
    const row = `${numStr} ${chevron} ${vl.text}`;
    if (len + row.length + 1 > maxLen) {
      lines.push("     ... truncated");
      break;
    }
    lines.push(row);
    len += row.length + 1;
  }
  return lines.join("\n");
}

export function extractKeyLabel(line: VisibleLine): string | null {
  const text = line.text.trimStart();
  if (!text) return null;

  // Closing brackets — skip entirely
  if (text.startsWith("}") || text.startsWith("]")) return null;

  // Root-level opening bracket — show as $ root
  if ((text === "{" || text === "[") && line.originalIndex === 0) return null;

  // Object key line: "key": value  or  "key": {
  const keyMatch = text.match(/^"([^"]*)":\s*/);
  if (keyMatch) {
    return keyMatch[1];
  }

  // Array element (no key) — show index-based label
  // These are lines inside arrays that aren't key-value pairs
  return null;
}

const NBSP = String.fromCharCode(160);

export function toNbspIndent(text: string): string {
  let i = 0;
  while (i < text.length && text[i] === " ") i++;
  if (i === 0) return text;
  return NBSP.repeat(i) + text.slice(i);
}
