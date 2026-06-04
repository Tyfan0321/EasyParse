import { ParseResult, ParserPlugin } from "../types";
import { jsonParser } from "./json";
import { jsonlParser } from "./jsonl";

export const registry: ParserPlugin[] = [jsonlParser, jsonParser];

export function parseAuto(input: string, opts?: { repair?: boolean }): ParseResult {
  if (!input.trim()) {
    return {
      ok: false,
      format: "unknown",
      error: { message: "Input is empty" },
      rawInput: input,
      triedRepair: !!opts?.repair,
    };
  }
  const ranked = [...registry].sort((a, b) => b.detect(input) - a.detect(input));
  const best = ranked[0];
  return best.parse(input, opts);
}
