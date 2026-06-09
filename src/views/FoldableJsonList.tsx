import { useCallback, useMemo, useState } from "react";
import { Action, ActionPanel, Color, Detail, Icon, List, useNavigation } from "@raycast/api";
import { ParsedNode } from "../types";
import { minified, pretty, truncateForPreview } from "../lib/format";
import { computeFoldRegions, buildVisibleLines, toNbspIndent, VisibleLine } from "../lib/fold";
import { NodeViewCtx } from "./JsonNodeView";
import { HistorySubmenu } from "./HistorySubmenu";

const MAX_FOLD_LINES = 5000;
const STRING_PREVIEW_LIMIT = 100_000;

interface Props {
  node: ParsedNode;
  pathStr: string;
  navigationTitle: string;
  ctx: NodeViewCtx;
}

export function FoldableJsonList({ node, pathStr, navigationTitle, ctx }: Props) {
  const { pop } = useNavigation();

  if (node.kind === "string") {
    return <StringFallbackDetail node={node} pathStr={pathStr} navigationTitle={navigationTitle} ctx={ctx} />;
  }

  const [folded, setFolded] = useState<Set<number>>(() => new Set());

  const { allLines, truncated, totalLineCount } = useMemo(() => {
    const raw = pretty(node.value).split("\n");
    if (raw.length > MAX_FOLD_LINES) {
      return { allLines: raw.slice(0, MAX_FOLD_LINES), truncated: true, totalLineCount: raw.length };
    }
    return { allLines: raw, truncated: false, totalLineCount: raw.length };
  }, [node.value]);

  const regions = useMemo(() => computeFoldRegions(allLines), [allLines]);

  const visibleLines = useMemo(() => buildVisibleLines(allLines, regions, folded), [allLines, regions, folded]);

  const toggleFold = useCallback((startLine: number) => {
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(startLine)) next.delete(startLine);
      else next.add(startLine);
      return next;
    });
  }, []);

  const foldAll = useCallback(() => {
    setFolded(new Set(regions.map((r) => r.startLine)));
  }, [regions]);

  const unfoldAll = useCallback(() => {
    setFolded(new Set());
  }, []);

  const fullPretty = useMemo(() => pretty(node.value), [node.value]);
  const meta = `${node.kind} · ${node.childCount} ${node.kind === "array" ? "items" : "keys"}`;
  const placeholder = `Search ${totalLineCount} lines · ${pathStr || "$"} · ${meta}`;

  return (
    <List navigationTitle={navigationTitle} searchBarPlaceholder={placeholder}>
      {visibleLines.map((line) => (
        <FoldLineItem
          key={line.originalIndex}
          line={line}
          allLines={allLines}
          onToggleFold={toggleFold}
          onFoldAll={foldAll}
          onUnfoldAll={unfoldAll}
          onPop={pop}
          ctx={ctx}
          fullPretty={fullPretty}
          nodeValue={node.value}
          hasFoldRegions={regions.length > 0}
        />
      ))}
      {truncated && (
        <List.Item
          title="… truncated"
          subtitle={`Showing first ${MAX_FOLD_LINES} of ${totalLineCount} lines`}
          icon={{ source: Icon.Warning, tintColor: Color.Yellow }}
          actions={
            <ActionPanel>
              <Action.CopyToClipboard title="Copy Full Pretty" content={fullPretty} />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}

function FoldLineItem({
  line,
  allLines,
  onToggleFold,
  onFoldAll,
  onUnfoldAll,
  onPop,
  ctx,
  fullPretty,
  nodeValue,
  hasFoldRegions,
}: {
  line: VisibleLine;
  allLines: string[];
  onToggleFold: (startLine: number) => void;
  onFoldAll: () => void;
  onUnfoldAll: () => void;
  onPop: () => void;
  ctx: NodeViewCtx;
  fullPretty: string;
  nodeValue: unknown;
  hasFoldRegions: boolean;
}) {
  const icon = line.foldable
    ? line.folded
      ? { source: Icon.ChevronRight, tintColor: Color.SecondaryText }
      : { source: Icon.ChevronDown, tintColor: Color.SecondaryText }
    : { source: Icon.Dot, tintColor: Color.SecondaryText };

  return (
    <List.Item
      id={String(line.originalIndex)}
      icon={icon}
      title={toNbspIndent(line.text)}
      accessories={[{ text: { value: String(line.originalIndex + 1), color: Color.SecondaryText } }]}
      keywords={[line.text.trim()]}
      actions={
        <ActionPanel>
          {line.foldable ? (
            <Action
              title={line.folded ? "Unfold" : "Fold"}
              icon={line.folded ? Icon.ChevronDown : Icon.ChevronRight}
              onAction={() => onToggleFold(line.originalIndex)}
            />
          ) : (
            <Action.CopyToClipboard title="Copy Line" content={allLines[line.originalIndex]} />
          )}
          <Action
            title="Edit Input"
            icon={Icon.Pencil}
            shortcut={{ modifiers: ["cmd"], key: "e" }}
            onAction={ctx.onEditRequest}
          />
          <Action.CopyToClipboard
            title="Copy Line"
            content={allLines[line.originalIndex]}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <Action.CopyToClipboard
            title="Copy Full Pretty"
            content={fullPretty}
            shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
          />
          {hasFoldRegions && (
            <ActionPanel.Section title="Folding">
              <Action
                title="Fold All"
                icon={Icon.Minimize}
                shortcut={{ modifiers: ["cmd", "shift"], key: "[" }}
                onAction={onFoldAll}
              />
              <Action
                title="Unfold All"
                icon={Icon.Maximize}
                shortcut={{ modifiers: ["cmd", "shift"], key: "]" }}
                onAction={onUnfoldAll}
              />
            </ActionPanel.Section>
          )}
          <ActionPanel.Section title="Document">
            <Action.CopyToClipboard title="Copy Minified" content={minified(nodeValue)} />
            <Action
              title="Back to Tree View"
              icon={Icon.AppWindowSidebarLeft}
              shortcut={{ modifiers: ["cmd"], key: "d" }}
              onAction={onPop}
            />
            <HistorySubmenu
              history={ctx.history}
              selectedEntryId={ctx.selectedEntryId}
              onSelectEntry={ctx.onSelectEntry}
              onAfterClear={ctx.onAfterHistoryCleared}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function StringFallbackDetail({ node, pathStr, navigationTitle, ctx }: Props) {
  const { pop } = useNavigation();
  const s = node.value as string;
  const { text, truncated } = truncateForPreview(s, STRING_PREVIEW_LIMIT);
  const header = `**${pathStr || "$"}** · \`string\``;
  const markdown = `${header}\n\n\`\`\`text\n${text}${truncated ? `\n…\n/* showing ${(text.length / 1024).toFixed(1)} KB of ${(s.length / 1024).toFixed(1)} KB */` : ""}\n\`\`\``;

  return (
    <Detail
      markdown={markdown}
      navigationTitle={navigationTitle}
      actions={
        <ActionPanel>
          <Action
            title="Edit Input"
            icon={Icon.Pencil}
            shortcut={{ modifiers: ["cmd"], key: "e" }}
            onAction={ctx.onEditRequest}
          />
          <Action.CopyToClipboard title="Copy Full Text" content={s} />
          <Action
            title="Back to Tree View"
            icon={Icon.AppWindowSidebarLeft}
            shortcut={{ modifiers: ["cmd"], key: "d" }}
            onAction={pop}
          />
          <Action.CopyToClipboard
            title="Copy Minified"
            content={minified(node.value)}
            shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
          />
        </ActionPanel>
      }
    />
  );
}
