import { LocalStorage, getPreferenceValues } from "@raycast/api";
import { Preferences } from "../types";

const STORAGE_KEY = "easy-parse:clipboard-history";
const PREVIEW_LEN = 60;
const HARD_MAX_ENTRIES = 50;
const DEFAULT_MAX_ENTRIES = 5;
const DEFAULT_MAX_BYTES = 100_000;

export interface HistoryEntry {
  id: string;
  text: string;
  timestamp: number;
  preview: string;
}

interface HistoryPrefs {
  enabled: boolean;
  maxEntries: number;
  maxBytes: number;
}

function readPrefs(): HistoryPrefs {
  try {
    const p = getPreferenceValues<Preferences>();
    const maxEntries = clampInt(p.historyMaxEntries, DEFAULT_MAX_ENTRIES, 1, HARD_MAX_ENTRIES);
    const maxBytes = clampInt(p.historyMaxBytes, DEFAULT_MAX_BYTES, 0, Number.MAX_SAFE_INTEGER);
    return { enabled: !!p.historyEnabled, maxEntries, maxBytes };
  } catch {
    return { enabled: true, maxEntries: DEFAULT_MAX_ENTRIES, maxBytes: DEFAULT_MAX_BYTES };
  }
}

function clampInt(raw: string, fallback: number, lo: number, hi: number): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  const prefs = readPrefs();
  if (!prefs.enabled) return [];
  const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => e && typeof e.id === "string" && typeof e.text === "string").slice(0, prefs.maxEntries);
  } catch {
    return [];
  }
}

export interface RecordResult {
  entries: HistoryEntry[];
  skipped: "disabled" | "too-large" | "empty" | undefined;
}

export async function recordHistory(text: string): Promise<RecordResult> {
  const prefs = readPrefs();
  if (!prefs.enabled) {
    return { entries: [], skipped: "disabled" };
  }
  if (!text.trim()) {
    return { entries: await loadHistory(), skipped: "empty" };
  }
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > prefs.maxBytes) {
    return { entries: await loadHistory(), skipped: "too-large" };
  }

  const current = await loadHistory();
  const now = Date.now();
  const existingIdx = current.findIndex((e) => e.text === text);
  let entries: HistoryEntry[];
  if (existingIdx >= 0) {
    const existing = { ...current[existingIdx], timestamp: now };
    entries = [existing, ...current.slice(0, existingIdx), ...current.slice(existingIdx + 1)];
  } else {
    const entry: HistoryEntry = {
      id: `h${now}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      timestamp: now,
      preview: buildPreview(text),
    };
    entries = [entry, ...current].slice(0, prefs.maxEntries);
  }
  await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  return { entries, skipped: undefined };
}

export async function clearHistory(): Promise<void> {
  await LocalStorage.removeItem(STORAGE_KEY);
}

function buildPreview(text: string): string {
  const flat = text.trim().replace(/\s+/g, " ");
  return flat.length > PREVIEW_LEN ? flat.slice(0, PREVIEW_LEN) + "…" : flat;
}
