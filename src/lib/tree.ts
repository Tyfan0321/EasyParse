import { NodeKind, ParsedNode, PathSegment } from "../types";

const MAX_DEPTH = 200;
const MAX_EAGER_CHILDREN = 10000;

export function kindOf(value: unknown): NodeKind {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  const t = typeof value;
  if (t === "object") return "object";
  if (t === "string" || t === "number" || t === "boolean") return t;
  return "null";
}

export function buildRoot(value: unknown): ParsedNode {
  return makeNode(value, [], undefined);
}

function makeNode(value: unknown, path: PathSegment[], key: PathSegment | undefined): ParsedNode {
  const kind = kindOf(value);
  if (kind === "object") {
    return { kind, key, path, value, childCount: Object.keys(value as object).length };
  }
  if (kind === "array") {
    return { kind, key, path, value, childCount: (value as unknown[]).length };
  }
  return { kind, key, path, value, childCount: 0 };
}

export function getChildren(node: ParsedNode): ParsedNode[] {
  if (node.children) return node.children;

  if (node.path.length >= MAX_DEPTH) {
    node.children = [];
    return node.children;
  }

  if (node.kind === "object") {
    const obj = node.value as Record<string, unknown>;
    const keys = Object.keys(obj);
    const limit = Math.min(keys.length, MAX_EAGER_CHILDREN);
    const children: ParsedNode[] = new Array(limit);
    for (let i = 0; i < limit; i++) {
      const k = keys[i];
      children[i] = makeNode(obj[k], [...node.path, k], k);
    }
    node.children = children;
    node.truncated = keys.length > limit;
    return children;
  }

  if (node.kind === "array") {
    const arr = node.value as unknown[];
    const limit = Math.min(arr.length, MAX_EAGER_CHILDREN);
    const children: ParsedNode[] = new Array(limit);
    for (let i = 0; i < limit; i++) {
      children[i] = makeNode(arr[i], [...node.path, i], i);
    }
    node.children = children;
    node.truncated = arr.length > limit;
    return children;
  }

  node.children = [];
  return node.children;
}

export function previewValue(node: ParsedNode, maxLen = 60): string {
  switch (node.kind) {
    case "object":
      return previewObject(node.value as Record<string, unknown>, node.childCount, maxLen);
    case "array":
      return previewArray(node.value as unknown[], maxLen);
    case "string":
      return truncate(JSON.stringify(node.value as string), maxLen);
    case "number":
    case "boolean":
      return String(node.value);
    case "null":
      return "null";
  }
}

function previewObject(obj: Record<string, unknown>, total: number, maxLen: number): string {
  if (total === 0) return "{}";
  const parts: string[] = [];
  let i = 0;
  for (const k of Object.keys(obj)) {
    if (i++ >= 4) break;
    parts.push(`${k}: ${stringifyShort(obj[k])}`);
  }
  return truncate(`{ ${parts.join(", ")}${total > 4 ? ", …" : ""} }`, maxLen);
}

function previewArray(arr: unknown[], maxLen: number): string {
  if (arr.length === 0) return "[]";
  const limit = Math.min(arr.length, 6);
  const parts: string[] = new Array(limit);
  for (let i = 0; i < limit; i++) parts[i] = stringifyShort(arr[i]);
  return truncate(`[ ${parts.join(", ")}${arr.length > limit ? ", …" : ""} ]`, maxLen);
}

function stringifyShort(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === "object") return "{…}";
  if (typeof v === "string") return JSON.stringify(v.length > 20 ? v.slice(0, 20) + "…" : v);
  return String(v);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
