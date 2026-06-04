import { Clipboard, getSelectedText } from "@raycast/api";

const BOM = "﻿";

export function normalize(input: string): string {
  let s = input;
  if (s.startsWith(BOM)) s = s.slice(BOM.length);
  return s.trim();
}

export async function readClipboardText(): Promise<string> {
  const text = await Clipboard.readText();
  return normalize(text ?? "");
}

export async function readSelectionText(): Promise<string> {
  try {
    const text = await getSelectedText();
    return normalize(text ?? "");
  } catch {
    // No selection / unsupported app — fall back silently.
    return "";
  }
}
