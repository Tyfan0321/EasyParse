import { ParseResult, ParserPlugin } from "../types";
import { buildRoot } from "../lib/tree";
import { detectJsonShape } from "../detectors/json-shape";
import { tryRepair } from "./repair";
import { extractParseError } from "./error";

export const jsonParser: ParserPlugin = {
  id: "json",
  label: "JSON",

  detect(input) {
    const shape = detectJsonShape(input);
    if (shape === "jsonl") return 0.1;
    if (shape === "unknown") return 0.3;
    return 0.9;
  },

  parse(input, opts) {
    const repair = !!opts?.repair;
    let source = input;
    let usedRepair = false;

    if (repair) {
      const repaired = tryRepair(input);
      if (repaired.ok && repaired.output != null) {
        source = repaired.output;
        usedRepair = true;
      }
    }

    try {
      const value = JSON.parse(source);
      return {
        ok: true,
        format: "json",
        root: buildRoot(value),
        usedRepair,
        rawInput: input,
      };
    } catch (e) {
      return {
        ok: false,
        format: "json",
        error: extractParseError(source, e),
        rawInput: input,
        triedRepair: repair,
      } satisfies ParseResult;
    }
  },
};
