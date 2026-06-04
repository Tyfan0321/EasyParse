import { ParseSuccess } from "../types";
import { JsonNodeView } from "./JsonNodeView";
import { HistoryEntry } from "../lib/history";

interface Props {
  result: ParseSuccess;
  inputSource: string;
  repair: boolean;
  onRepairToggle: () => void;
  onRefresh: () => Promise<void> | void;
  onEditRequest: () => void;
  history?: HistoryEntry[];
  selectedEntryId?: string;
  onSelectEntry?: (id: string) => void;
  onAfterHistoryCleared?: () => void;
}

export function JsonDetail(props: Props) {
  const root = props.result.root;
  const title = props.result.usedRepair ? "Easy Parse (repaired)" : "Easy Parse";
  return (
    <JsonNodeView
      node={root}
      navigationTitle={title}
      ctx={{
        inputSource: props.inputSource,
        repair: props.repair,
        rootValue: root.value,
        onRepairToggle: props.onRepairToggle,
        onRefresh: props.onRefresh,
        onEditRequest: props.onEditRequest,
        history: props.history,
        selectedEntryId: props.selectedEntryId,
        onSelectEntry: props.onSelectEntry,
        onAfterHistoryCleared: props.onAfterHistoryCleared,
      }}
    />
  );
}
