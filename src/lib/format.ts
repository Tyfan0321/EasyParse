export function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function minified(value: unknown): string {
  return JSON.stringify(value);
}

export function offsetToLineCol(source: string, offset: number): { line: number; column: number } {
  const slice = source.slice(0, Math.max(0, Math.min(offset, source.length)));
  const lines = slice.split(/\r?\n/);
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  return { line, column };
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function byteLength(input: string): number {
  return Buffer.byteLength(input, "utf8");
}

export function truncateForPreview(input: string, maxBytes: number): { text: string; truncated: boolean } {
  if (byteLength(input) <= maxBytes) return { text: input, truncated: false };
  // Byte-safe slice: cut by length and re-check.
  let lo = 0;
  let hi = input.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (Buffer.byteLength(input.slice(0, mid), "utf8") <= maxBytes) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return { text: input.slice(0, lo), truncated: true };
}
