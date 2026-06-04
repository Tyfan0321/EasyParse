import { Action, ActionPanel, Detail, Icon } from "@raycast/api";
import { ParseFailure } from "../types";
import { HistoryEntry } from "../lib/history";
import { HistorySubmenu } from "./HistorySubmenu";

interface Props {
  result: ParseFailure;
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

const SLICE_RADIUS = 80;

export function ErrorView({
  result,
  inputSource,
  repair,
  onRepairToggle,
  onRefresh,
  onEditRequest,
  history,
  selectedEntryId,
  onSelectEntry,
  onAfterHistoryCleared,
}: Props) {
  const { error, rawInput, triedRepair } = result;

  let snippet: string;
  if (rawInput.length === 0) {
    snippet = "(empty)";
  } else if (error.offset !== undefined) {
    const start = Math.max(0, error.offset - SLICE_RADIUS);
    const end = Math.min(rawInput.length, error.offset + SLICE_RADIUS);
    snippet = `${rawInput.slice(start, error.offset)}⟶${rawInput.slice(error.offset, end)}`;
  } else {
    snippet = rawInput.length > SLICE_RADIUS * 2 ? `${rawInput.slice(0, SLICE_RADIUS * 2)}…` : rawInput;
  }

  const headerLines = [
    `**Parse failed** · Source: ${inputSource}`,
    error.line !== undefined ? `**Location:** line ${error.line}, column ${error.column}` : undefined,
    triedRepair ? "**Lenient repair was tried but the input could not be repaired.**" : undefined,
  ].filter(Boolean) as string[];

  const markdown = [
    headerLines.join("\n\n"),
    "",
    `> ${error.message}`,
    "",
    "```json",
    snippet,
    "```",
    "",
    rawInput.trim()
      ? "Use **Edit Input** or **Try Lenient Repair** below to fix."
      : "No input. Use **Edit Input** to paste manually, or **Switch History** (⌘⇧H) to load a previous parse.",
  ].join("\n");

  return (
    <Detail
      markdown={markdown}
      navigationTitle="Easy Parse — Error"
      actions={
        <ActionPanel>
          <Action title="Edit Input" icon={Icon.Pencil} onAction={onEditRequest} />
          {!triedRepair && (
            <Action
              title="Try Lenient Repair"
              icon={Icon.BandAid}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
              onAction={onRepairToggle}
            />
          )}
          <Action
            title="Re-read Input Source"
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ["cmd", "opt"], key: "v" }}
            onAction={() => void onRefresh()}
          />
          <HistorySubmenu
            history={history}
            selectedEntryId={selectedEntryId}
            onSelectEntry={onSelectEntry}
            onAfterClear={onAfterHistoryCleared}
          />
          {repair && (
            <Action
              title="Disable Lenient Repair"
              icon={Icon.XMarkCircle}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
              onAction={onRepairToggle}
            />
          )}
          <Action.CopyToClipboard
            title="Copy Raw Input"
            content={rawInput}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
        </ActionPanel>
      }
    />
  );
}
