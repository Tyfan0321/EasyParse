import { JsonlLine, ParseResult, ParserPlugin } from "../types";
import { buildRoot } from "../lib/tree";
import { detectJsonShape } from "../detectors/json-shape";
import { tryRepair } from "./repair";

export const jsonlParser: ParserPlugin = {
  id: "jsonl",
  label: "JSONL",

  detect(input) {
    return detectJsonShape(input) === "jsonl" ? 0.95 : 0.05;
  },

  parse(input, opts) {
    const repair = !!opts?.repair;
    const rawLines: { raw: string; index: number }[] = [];
    let start = 0;
    let index = 0;
    for (let i = 0; i <= input.length; i++) {
      const c = i === input.length ? "\n" : input[i];
      if (c === "\n" || (c === "\r" && input[i + 1] === "\n")) {
        const raw = input.slice(start, i);
        if (raw.trim().length > 0) rawLines.push({ raw, index: index++ });
        if (c === "\r") i++;
        start = i + 1;
      }
    }

    let usedRepair = false;
    const lines: JsonlLine[] = new Array(rawLines.length);
    for (let i = 0; i < rawLines.length; i++) {
      const { raw, index } = rawLines[i];
      let source = raw;
      let lineRepaired = false;
      if (repair) {
        const r = tryRepair(raw);
        if (r.ok && r.output != null) {
          source = r.output;
          lineRepaired = true;
        }
      }
      try {
        const value = JSON.parse(source);
        if (lineRepaired) usedRepair = true;
        lines[i] = { index, raw, root: buildRoot(value) };
      } catch (e) {
        lines[i] = { index, raw, root: buildRoot(null), error: (e as Error).message };
      }
    }

    if (lines.length === 0) {
      return {
        ok: false,
        format: "jsonl",
        error: { message: "Input has no non-empty lines" },
        rawInput: input,
        triedRepair: repair,
      } satisfies ParseResult;
    }

    return {
      ok: true,
      format: "jsonl",
      root: buildRoot(null),
      lines,
      usedRepair,
      rawInput: input,
    };
  },
};
