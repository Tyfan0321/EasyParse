import { Action, ActionPanel, Icon, Toast, showToast } from "@raycast/api";
import { HistoryEntry, clearHistory } from "../lib/history";

interface Props {
  history?: HistoryEntry[];
  selectedEntryId?: string;
  onSelectEntry?: (id: string) => void;
  onAfterClear?: () => void;
}

export function HistorySubmenu({ history, selectedEntryId, onSelectEntry, onAfterClear }: Props) {
  if (!history || history.length === 0 || !onSelectEntry) return null;

  return (
    <ActionPanel.Submenu
      title={`Switch History (${history.length})`}
      icon={Icon.Clock}
      shortcut={{ modifiers: ["cmd"], key: "h" }}
    >
      {history.map((entry) => (
        <Action
          key={entry.id}
          title={`${entry.id === selectedEntryId ? "● " : "  "}${formatTime(entry.timestamp)} · ${entry.preview}`}
          onAction={() => onSelectEntry(entry.id)}
        />
      ))}
      <Action
        title="Clear History"
        icon={Icon.Trash}
        onAction={async () => {
          await clearHistory();
          await showToast({ style: Toast.Style.Success, title: "History cleared" });
          onAfterClear?.();
        }}
      />
    </ActionPanel.Submenu>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
