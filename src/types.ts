export type NodeKind = "object" | "array" | "string" | "number" | "boolean" | "null";

export type PathSegment = string | number;

export interface ParsedNode {
  kind: NodeKind;
  key?: PathSegment;
  path: PathSegment[];
  value: unknown;
  children?: ParsedNode[];
  childCount: number;
  truncated?: boolean;
}

export interface JsonlLine {
  index: number;
  raw: string;
  root: ParsedNode;
  error?: string;
}

export interface ParseSuccess {
  ok: true;
  format: "json" | "jsonl";
  root: ParsedNode;
  lines?: JsonlLine[];
  usedRepair: boolean;
  rawInput: string;
}

export interface ParseError {
  message: string;
  offset?: number;
  line?: number;
  column?: number;
}

export interface ParseFailure {
  ok: false;
  format: "json" | "jsonl" | "unknown";
  error: ParseError;
  rawInput: string;
  triedRepair: boolean;
}

export type ParseResult = ParseSuccess | ParseFailure;

export interface ParserPlugin {
  id: string;
  label: string;
  detect(input: string): number;
  parse(input: string, opts?: { repair?: boolean }): ParseResult;
}

export type PathStyle = "jsonpath" | "bracket" | "dot";

export interface Preferences {
  maxBytes: string;
  autoRepair: boolean;
  pathStyle: PathStyle;
  historyEnabled: boolean;
  historyMaxEntries: string;
  historyMaxBytes: string;
}
