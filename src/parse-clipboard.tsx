import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { getPreferenceValues, useNavigation } from "@raycast/api";
import { ParseResultRouter } from "./views/ParseResultRouter";
import { EditForm } from "./views/EditForm";
import { readClipboardText } from "./lib/clipboard";
import { HistoryEntry, loadHistory, recordHistory } from "./lib/history";
import { parseAuto } from "./parsers";
import { Preferences } from "./types";

export default function ParseClipboard() {
  const { autoRepair } = getPreferenceValues<Preferences>();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [repair, setRepair] = useState<boolean>(autoRepair);
  const { push, pop } = useNavigation();
  // Texts we have already attempted to record this session — avoids re-record loops.
  const recordedRef = useRef<Set<string>>(new Set());

  // Initial load: read clipboard. If it matches an existing history entry, move-to-front
  // and select it. Otherwise just set as current text — we'll record it later iff it parses ok.
  useEffect(() => {
    void (async () => {
      try {
        const existing = await loadHistory();
        const clip = await readClipboardText();
        if (clip) {
          const matched = existing.find((e) => e.text === clip);
          if (matched) {
            const { entries } = await recordHistory(clip); // move-to-front
            recordedRef.current.add(clip);
            setHistory(entries);
            setSelectedId(entries[0].id);
            setText(entries[0].text);
          } else {
            setHistory(existing);
            setSelectedId(undefined);
            setText(clip);
          }
        } else {
          setHistory(existing);
          if (existing.length > 0) {
            setSelectedId(existing[0].id);
            setText(existing[0].text);
          }
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Parse the current text. Same call ParseResultRouter makes; cheap because we made
  // buildRoot lazy and dropped prettyText pre-computation.
  const parseResult = useMemo(() => (text ? parseAuto(text, { repair }) : null), [text, repair]);

  // Record to history only after a successful parse, and only once per session per text.
  useEffect(() => {
    if (!text || !parseResult?.ok) return;
    if (recordedRef.current.has(text)) return;
    recordedRef.current.add(text);
    void (async () => {
      const { entries } = await recordHistory(text);
      if (entries.length === 0) return;
      setHistory(entries);
      if (entries[0].text === text) setSelectedId(entries[0].id);
    })();
  }, [text, parseResult]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const clip = await readClipboardText();
      if (clip) setText(clip);
      // History recording will trigger from the parse-result useEffect if parse succeeds.
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectEntry = useCallback(
    (id: string) => {
      const entry = history.find((e) => e.id === id);
      if (!entry) return;
      setSelectedId(id);
      setText(entry.text);
    },
    [history],
  );

  const onAfterHistoryCleared = useCallback(() => {
    recordedRef.current = new Set();
    setHistory([]);
    setSelectedId(undefined);
  }, []);

  const applyManualEdit = useCallback((newText: string, opts?: { repair?: boolean }) => {
    setText(newText);
    if (opts?.repair !== undefined) setRepair(opts.repair);
    // Recording happens via the parse-result useEffect once parse succeeds.
  }, []);

  const onEditRequest = useCallback(() => {
    push(
      <EditForm
        initial={text}
        onSubmit={(newText, opts) => {
          applyManualEdit(newText, opts);
          pop();
        }}
      />,
    );
  }, [push, pop, text, applyManualEdit]);

  return (
    <ParseResultRouter
      text={text}
      source="clipboard"
      loading={loading}
      errorMessage={error}
      repair={repair}
      onRepairToggle={() => setRepair((v) => !v)}
      onRefresh={refresh}
      onEditRequest={onEditRequest}
      history={history}
      selectedEntryId={selectedId}
      onSelectEntry={selectEntry}
      onAfterHistoryCleared={onAfterHistoryCleared}
    />
  );
}
