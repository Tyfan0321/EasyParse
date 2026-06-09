import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Action, ActionPanel, Color, Detail, Icon, List, useNavigation } from "@raycast/api";
import { ParsedNode, NodeKind } from "../types";
import { minified, pretty, truncateForPreview } from "../lib/format";
import { computeFoldRegions, buildVisibleLines, buildFoldedPreview, extractKeyLabel, VisibleLine } from "../lib/fold";
import { NodeViewCtx, iconForKind } from "./JsonNodeView";
import { HistorySubmenu } from "./HistorySubmenu";

const MAX_FOLD_LINES = 2000;
const DETAIL_PREVIEW_LIMIT = 40_000;
const STRING_PREVIEW_LIMIT = 100_000;

interface Props {
  node: ParsedNode;
  pathStr: string;
  navigationTitle: string;
  ctx: NodeViewCtx;
}

interface KeyItem {
  line: VisibleLine;
  label: string;
  depth: number;
  valueKind: NodeKind;
  childCount?: number;
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
  const regionByStart = useMemo(() => new Map(regions.map((r) => [r.startLine, r])), [regions]);

  const visibleLines = useMemo(() => buildVisibleLines(allLines, regions, folded), [allLines, regions, folded]);

  const detailMarkdown = useMemo(() => {
    const preview = buildFoldedPreview(visibleLines, DETAIL_PREVIEW_LIMIT);
    return `\`\`\`json\n${preview}\n\`\`\``;
  }, [visibleLines]);

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

  const fullPrettyRef = useRef<string>("");
  const fullPretty = useMemo(() => {
    const v = pretty(node.value);
    fullPrettyRef.current = v;
    return v;
  }, [node.value]);

  const meta = `${node.kind} · ${node.childCount} ${node.kind === "array" ? "items" : "keys"}`;
  const placeholder = `Search ${totalLineCount} lines · ${pathStr || "$"} · ${meta}`;

  const keyItems = useMemo(() => {
    const items: KeyItem[] = [];
    for (const vl of visibleLines) {
      const label = extractKeyLabel(vl);
      if (label === null) continue;
      const indent = vl.text.length - vl.text.trimStart().length;
      const depth = Math.floor(indent / 2);
      const region = regionByStart.get(vl.originalIndex);

      const afterKey = vl.text
        .trimStart()
        .replace(/^"[^"]*":\s*/, "")
        .replace(/,\s*$/, "");

      let valueKind: NodeKind;
      let childCount: number | undefined;

      if (region) {
        valueKind = region.containerKind;
        childCount = region.childCount;
      } else {
        valueKind = guessKind(afterKey);
      }

      items.push({ line: vl, label, depth, valueKind, childCount });
    }
    return items;
  }, [visibleLines, regionByStart]);

  return (
    <List isShowingDetail navigationTitle={navigationTitle} searchBarPlaceholder={placeholder}>
      {keyItems.map((item) => (
        <MemoizedFoldLineItem
          key={item.line.originalIndex}
          item={item}
          detailMarkdown={detailMarkdown}
          onToggleFold={toggleFold}
          onFoldAll={foldAll}
          onUnfoldAll={unfoldAll}
          onPop={pop}
          onEditRequest={ctx.onEditRequest}
          history={ctx.history}
          selectedEntryId={ctx.selectedEntryId}
          onSelectEntry={ctx.onSelectEntry}
          onAfterHistoryCleared={ctx.onAfterHistoryCleared}
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
          detail={<List.Item.Detail markdown={detailMarkdown} />}
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

const MemoizedFoldLineItem = memo(FoldLineItem, (prev, next) => {
  return (
    prev.item.line.originalIndex === next.item.line.originalIndex &&
    prev.item.line.folded === next.item.line.folded &&
    prev.item.label === next.item.label &&
    prev.item.depth === next.item.depth &&
    prev.detailMarkdown === next.detailMarkdown &&
    prev.hasFoldRegions === next.hasFoldRegions
  );
});

function FoldLineItem({
  item,
  detailMarkdown,
  onToggleFold,
  onFoldAll,
  onUnfoldAll,
  onPop,
  onEditRequest,
  history,
  selectedEntryId,
  onSelectEntry,
  onAfterHistoryCleared,
  fullPretty,
  nodeValue,
  hasFoldRegions,
}: {
  item: KeyItem;
  detailMarkdown: string;
  onToggleFold: (startLine: number) => void;
  onFoldAll: () => void;
  onUnfoldAll: () => void;
  onPop: () => void;
  onEditRequest: () => void;
  history?: import("../lib/history").HistoryEntry[];
  selectedEntryId?: string;
  onSelectEntry?: (id: string) => void;
  onAfterHistoryCleared?: () => void;
  fullPretty: string;
  nodeValue: unknown;
  hasFoldRegions: boolean;
}) {
  const { line, label, depth, valueKind, childCount } = item;
  const isContainer = valueKind === "object" || valueKind === "array";

  const depthTag = `L${depth}`;

  const accessories: List.Item.Accessory[] = [
    { tag: { value: depthTag, color: Color.SecondaryText } },
    ...(isContainer && childCount !== undefined ? [{ text: String(childCount) }] : []),
    ...(line.foldable ? [{ icon: line.folded ? Icon.ChevronRight : Icon.ChevronDown }] : []),
  ];

  return (
    <List.Item
      id={String(line.originalIndex)}
      icon={iconForKind(valueKind)}
      title={label}
      accessories={accessories}
      keywords={[label, depthTag]}
      detail={<List.Item.Detail markdown={detailMarkdown} />}
      actions={
        <ActionPanel>
          {line.foldable && (
            <Action
              title={line.folded ? "Unfold" : "Fold"}
              icon={line.folded ? Icon.ChevronDown : Icon.ChevronRight}
              onAction={() => onToggleFold(line.originalIndex)}
            />
          )}
          <Action
            title="Edit Input"
            icon={Icon.Pencil}
            shortcut={{ modifiers: ["cmd"], key: "e" }}
            onAction={onEditRequest}
          />
          <Action.CopyToClipboard
            title="Copy Full Pretty"
            content={fullPretty}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
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
              history={history}
              selectedEntryId={selectedEntryId}
              onSelectEntry={onSelectEntry}
              onAfterClear={onAfterHistoryCleared}
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

function guessKind(raw: string): NodeKind {
  if (raw === "null") return "null";
  if (raw === "true" || raw === "false") return "boolean";
  if (raw.startsWith('"')) return "string";
  if (raw.startsWith("{")) return "object";
  if (raw.startsWith("[")) return "array";
  if (/^-?[\d.]/.test(raw)) return "number";
  return "string";
}
