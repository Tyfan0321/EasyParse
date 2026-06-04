export type JsonShape = "single-line-json" | "multi-line-json" | "jsonl" | "unknown";

const JSONL_PROBE_LIMIT = 50; // only check first N non-empty lines for JSONL detection

export function detectJsonShape(input: string): JsonShape {
  const trimmed = input.trim();
  if (!trimmed) return "unknown";

  // Cheap probe: scan up to JSONL_PROBE_LIMIT lines without splitting the whole input.
  let lineCount = 0;
  let allLinesAreJson = true;
  let probeFinished = false;
  let cursor = 0;
  const len = trimmed.length;

  while (cursor < len && lineCount < JSONL_PROBE_LIMIT) {
    let newline = trimmed.indexOf("\n", cursor);
    if (newline === -1) newline = len;
    const rawLine = trimmed.slice(cursor, newline);
    cursor = newline + 1;
    const s = rawLine.replace(/^\s+|\s+$/g, "");
    if (s.length === 0) continue;
    lineCount++;
    if (!(s.startsWith("{") || s.startsWith("["))) {
      allLinesAreJson = false;
      break;
    }
    try {
      JSON.parse(s);
    } catch {
      allLinesAreJson = false;
      break;
    }
  }
  if (cursor >= len) probeFinished = true;

  if (lineCount >= 2 && allLinesAreJson) {
    return "jsonl";
  }
  if (lineCount === 1 && probeFinished) return "single-line-json";

  try {
    JSON.parse(trimmed);
    return "multi-line-json";
  } catch {
    return "unknown";
  }
}
