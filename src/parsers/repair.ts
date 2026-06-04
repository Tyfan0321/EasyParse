import { jsonrepair } from "jsonrepair";

export interface RepairResult {
  ok: boolean;
  output?: string;
  error?: string;
}

export function tryRepair(input: string): RepairResult {
  try {
    return { ok: true, output: jsonrepair(input) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
