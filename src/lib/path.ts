import { PathSegment, PathStyle } from "../types";

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function formatPath(path: PathSegment[], style: PathStyle): string {
  if (path.length === 0) {
    return style === "jsonpath" ? "$" : style === "dot" ? "" : "";
  }
  switch (style) {
    case "jsonpath":
      return (
        "$" +
        path
          .map((seg) =>
            typeof seg === "number" ? `[${seg}]` : IDENT_RE.test(seg) ? `.${seg}` : `["${escapeKey(seg)}"]`,
          )
          .join("")
      );
    case "bracket":
      return path.map((seg) => (typeof seg === "number" ? `[${seg}]` : `["${escapeKey(seg)}"]`)).join("");
    case "dot":
      return path.map((seg) => String(seg)).join(".");
  }
}

function escapeKey(k: string): string {
  return k.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
