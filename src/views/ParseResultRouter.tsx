import { useMemo } from "react";
import { Detail } from "@raycast/api";
import { parseAuto } from "../parsers";
import { JsonDetail } from "./JsonDetail";
import { JsonlDetail } from "./JsonlDetail";
import { ErrorView } from "./ErrorView";
import { HistoryEntry } from "../lib/history";

export interface ParseResultRouterProps {
  text: string;
  source: string;
  repair: boolean;
  loading?: boolean;
  errorMessage?: string;
  onRepairToggle: () => void;
  onRefresh?: () => Promise<void> | void;
  onEditRequest: () => void;
  history?: HistoryEntry[];
  selectedEntryId?: string;
  onSelectEntry?: (id: string) => void;
  onAfterHistoryCleared?: () => void;
}

export function ParseResultRouter(props: ParseResultRouterProps) {
  const {
    text,
    source,
    repair,
    loading,
    errorMessage,
    onRepairToggle,
    onRefresh,
    onEditRequest,
    history,
    selectedEntryId,
    onSelectEntry,
    onAfterHistoryCleared,
  } = props;

  const result = useMemo(() => parseAuto(text, { repair }), [text, repair]);

  if (loading) {
    return <Detail isLoading markdown="" navigationTitle="Easy Parse" />;
  }
  if (errorMessage) {
    return <Detail markdown={`**Error reading input:** ${errorMessage}`} navigationTitle="Easy Parse" />;
  }

  const shared = {
    inputSource: source,
    repair,
    onRepairToggle,
    onRefresh: onRefresh ?? (() => undefined),
    onEditRequest,
    history,
    selectedEntryId,
    onSelectEntry,
    onAfterHistoryCleared,
  };

  if (!result.ok) {
    return <ErrorView result={result} {...shared} />;
  }
  if (result.format === "jsonl") {
    return <JsonlDetail result={result} {...shared} />;
  }
  return <JsonDetail result={result} {...shared} />;
}
