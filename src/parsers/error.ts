import { offsetToLineCol } from "../lib/format";
import { ParseError } from "../types";

const POS_LINE_COL = /at position (\d+) \(line (\d+) column (\d+)\)/;
const POS_ONLY = /at position (\d+)/;

export function extractParseError(source: string, e: unknown): ParseError {
  const message = e instanceof Error ? e.message : String(e);

  const matchLC = POS_LINE_COL.exec(message);
  if (matchLC) {
    return {
      message: cleanMessage(message),
      offset: Number(matchLC[1]),
      line: Number(matchLC[2]),
      column: Number(matchLC[3]),
    };
  }

  const matchPos = POS_ONLY.exec(message);
  if (matchPos) {
    const offset = Number(matchPos[1]);
    const { line, column } = offsetToLineCol(source, offset);
    return { message: cleanMessage(message), offset, line, column };
  }

  return { message: cleanMessage(message) };
}

function cleanMessage(msg: string): string {
  // V8 ≥4.6 format: `<short reason>, "<entire input>" is not valid JSON`.
  // The embedded snippet may contain quotes and newlines, so locate the
  // ` is not valid JSON` tail first and then strip the embed prefix.
  const tailIdx = msg.lastIndexOf(" is not valid JSON");
  if (tailIdx >= 0) {
    const head = msg.slice(0, tailIdx);
    const embedMatch = /^(.*?),\s+(?:\.\.\.)?"/s.exec(head);
    return (embedMatch ? embedMatch[1] : head).trim();
  }
  // Positioned format: `<reason> in JSON at position N (line X column Y)`.
  return msg
    .replace(/\s+in JSON\b/, "")
    .replace(/\s+at position \d+(?:\s+\(line \d+ column \d+\))?/, "")
    .trim();
}
