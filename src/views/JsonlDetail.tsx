import { Action, ActionPanel, Color, Icon, List, Toast, showToast, useNavigation } from "@raycast/api";
import { JsonlLine, ParseSuccess } from "../types";
import { previewValue } from "../lib/tree";
import { minified, pretty } from "../lib/format";
import { JsonNodeView, iconForKind, buildDetailMarkdown } from "./JsonNodeView";
import { HistoryEntry } from "../lib/history";
import { HistorySubmenu } from "./HistorySubmenu";

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

export function JsonlDetail(props: Props) {
  const {
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
  } = props;
  const { push } = useNavigation();
  const lines = result.lines ?? [];
  const failingCount = lines.filter((l) => l.error).length;
  const validValues = lines.filter((l) => !l.error).map((l) => l.root.value);

  const titleSuffix = result.usedRepair ? " (repaired)" : "";
  const navTitle = `Easy Parse — JSONL${titleSuffix}`;
  const placeholder = `Filter ${lines.length} lines${failingCount ? ` (${failingCount} failed)` : ""}…`;

  return (
    <List isShowingDetail navigationTitle={navTitle} searchBarPlaceholder={placeholder}>
      {lines.map((line) => (
        <LineItem
          key={line.index}
          line={line}
          inputSource={inputSource}
          repair={repair}
          onEditRequest={onEditRequest}
          onRepairToggle={onRepairToggle}
          onRefresh={onRefresh}
          validValues={validValues}
          history={history}
          selectedEntryId={selectedEntryId}
          onSelectEntry={onSelectEntry}
          onAfterHistoryCleared={onAfterHistoryCleared}
          onDrillIn={() =>
            push(
              <JsonNodeView
                node={line.root}
                navigationTitle={`Line ${line.index + 1}`}
                ctx={{
                  inputSource,
                  repair,
                  rootValue: line.root.value,
                  onEditRequest,
                  onRepairToggle,
                  onRefresh,
                  history,
                  selectedEntryId,
                  onSelectEntry,
                  onAfterHistoryCleared,
                }}
              />,
            )
          }
        />
      ))}
    </List>
  );
}

interface LineItemProps {
  line: JsonlLine;
  inputSource: string;
  repair: boolean;
  onEditRequest: () => void;
  onRepairToggle: () => void;
  onRefresh: () => Promise<void> | void;
  onDrillIn: () => void;
  validValues: unknown[];
  history?: HistoryEntry[];
  selectedEntryId?: string;
  onSelectEntry?: (id: string) => void;
  onAfterHistoryCleared?: () => void;
}

function LineItem({
  line,
  inputSource,
  repair,
  onEditRequest,
  onRepairToggle,
  onRefresh,
  onDrillIn,
  validValues,
  history,
  selectedEntryId,
  onSelectEntry,
  onAfterHistoryCleared,
}: LineItemProps) {
  const historySubmenu = (
    <HistorySubmenu
      history={history}
      selectedEntryId={selectedEntryId}
      onSelectEntry={onSelectEntry}
      onAfterClear={onAfterHistoryCleared}
    />
  );
  const title = `line ${line.index + 1}`;
  const flatNotSupportedAction = (
    <Action
      title="View as Flat"
      icon={Icon.Eye}
      shortcut={{ modifiers: ["cmd"], key: "d" }}
      onAction={async () => {
        const toast = await showToast({
          style: Toast.Style.Success,
          title: "Flat view not available for JSONL",
          message: "Drill into a line first (↩), then press ⌘D",
        });
        setTimeout(() => void toast.hide(), 1000);
      }}
    />
  );

  if (line.error) {
    return (
      <List.Item
        icon={{ source: Icon.XMarkCircle, tintColor: Color.Red }}
        title={title}
        subtitle={line.error}
        accessories={[{ tag: { value: "error", color: Color.Red } }]}
        detail={
          <List.Item.Detail
            markdown={`**Line ${line.index + 1}** · parse failed\n\n> ${line.error}\n\n\`\`\`text\n${line.raw}\n\`\`\``}
          />
        }
        actions={
          <ActionPanel>
            <Action
              title="Edit Input"
              icon={Icon.Pencil}
              shortcut={{ modifiers: ["cmd"], key: "e" }}
              onAction={onEditRequest}
            />
            {flatNotSupportedAction}
            <Action.CopyToClipboard
              title="Copy Raw Line"
              content={line.raw}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
            {historySubmenu}
            <Action
              title={repair ? "Disable Lenient Repair" : "Toggle Lenient Repair"}
              icon={Icon.BandAid}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
              onAction={onRepairToggle}
            />
            <Action
              title="Re-read Input Source"
              icon={Icon.ArrowClockwise}
              shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
              onAction={() => void onRefresh()}
            />
          </ActionPanel>
        }
      />
    );
  }

  const root = line.root;
  const isContainer = root.kind === "object" || root.kind === "array";

  return (
    <List.Item
      icon={iconForKind(root.kind)}
      title={title}
      subtitle={previewValue(root, 100)}
      accessories={[{ tag: root.kind }, ...(isContainer ? [{ text: String(root.childCount) }] : [])]}
      detail={<LazyLineDetail line={line} />}
      actions={
        <ActionPanel>
          <Action title="Drill into Line" icon={Icon.ArrowRightCircle} onAction={onDrillIn} />
          {flatNotSupportedAction}
          <Action
            title="Edit Input"
            icon={Icon.Pencil}
            shortcut={{ modifiers: ["cmd"], key: "e" }}
            onAction={onEditRequest}
          />
          <Action.CopyToClipboard
            title="Copy Line (pretty)"
            content={pretty(root.value)}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <Action.CopyToClipboard
            title="Copy Line (minified)"
            content={minified(root.value)}
            shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
          />
          <Action.CopyToClipboard title="Copy Raw Line" content={line.raw} />
          {historySubmenu}
          <ActionPanel.Section title="Document">
            <Action.CopyToClipboard
              title="Copy All Lines as JSON Array"
              content={pretty(validValues)}
              shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
            />
            <Action.CopyToClipboard
              title="Copy All Lines (minified)"
              content={minified(validValues)}
              shortcut={{ modifiers: ["cmd", "opt", "shift"], key: "c" }}
            />
            <Action title={`Source: ${inputSource}`} icon={Icon.Info} onAction={() => undefined} />
            <Action
              title={repair ? "Disable Lenient Repair" : "Toggle Lenient Repair"}
              icon={Icon.BandAid}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
              onAction={onRepairToggle}
            />
            <Action
              title="Re-read Input Source"
              icon={Icon.ArrowClockwise}
              shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
              onAction={() => void onRefresh()}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function LazyLineDetail({ line }: { line: JsonlLine }) {
  // Markdown only computed when Raycast actually renders this detail panel
  // (i.e. when the line is the focused item).
  return <List.Item.Detail markdown={buildDetailMarkdown(line.root, `Line ${line.index + 1}`)} />;
}
