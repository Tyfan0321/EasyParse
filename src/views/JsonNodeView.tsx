import { useMemo, useState } from "react";
import { Action, ActionPanel, Color, Detail, Icon, List, useNavigation, getPreferenceValues } from "@raycast/api";
import { ParsedNode, PathStyle, Preferences } from "../types";
import { getChildren, previewValue } from "../lib/tree";
import { formatPath } from "../lib/path";
import { minified, pretty, truncateForPreview } from "../lib/format";
import { HistoryEntry } from "../lib/history";
import { HistorySubmenu } from "./HistorySubmenu";

export interface NodeViewCtx {
  inputSource: string;
  repair: boolean;
  rootValue: unknown;
  onRepairToggle: () => void;
  onRefresh: () => Promise<void> | void;
  onEditRequest: () => void;
  history?: HistoryEntry[];
  selectedEntryId?: string;
  onSelectEntry?: (id: string) => void;
  onAfterHistoryCleared?: () => void;
}

interface Props {
  node: ParsedNode;
  navigationTitle: string;
  ctx: NodeViewCtx;
}

export function JsonNodeView({ node, navigationTitle, ctx }: Props) {
  const { push } = useNavigation();
  const { pathStyle } = getPreferenceValues<Preferences>();
  const isContainer = node.kind === "object" || node.kind === "array";

  if (!isContainer) {
    return (
      <Detail
        markdown={buildDetailMarkdown(node, formatPath(node.path, pathStyle))}
        navigationTitle={navigationTitle}
        actions={<NodeActions node={node} pathStyle={pathStyle} ctx={ctx} />}
      />
    );
  }

  const children = getChildren(node);
  const placeholder = `Filter ${node.childCount} ${node.kind === "array" ? "items" : "keys"}…`;

  return (
    <List isShowingDetail navigationTitle={navigationTitle} searchBarPlaceholder={placeholder}>
      {children.map((child) => (
        <ChildItem
          key={`${String(child.key)}-${child.kind}`}
          child={child}
          pathStyle={pathStyle}
          ctx={ctx}
          viewNode={node}
          onDrillIn={() =>
            push(<JsonNodeView node={child} navigationTitle={`${navigationTitle} › ${String(child.key)}`} ctx={ctx} />)
          }
        />
      ))}
      {node.truncated && (
        <List.Item
          title="…truncated"
          subtitle={`Only first ${children.length} of ${node.childCount} children shown`}
          icon={{ source: Icon.Warning, tintColor: Color.Yellow }}
        />
      )}
    </List>
  );
}

function ChildItem({
  child,
  pathStyle,
  ctx,
  viewNode,
  onDrillIn,
}: {
  child: ParsedNode;
  pathStyle: PathStyle;
  ctx: NodeViewCtx;
  viewNode: ParsedNode;
  onDrillIn: () => void;
}) {
  const isContainer = child.kind === "object" || child.kind === "array";
  const keyLabel = String(child.key ?? "");
  const childPath = formatPath(child.path, pathStyle);

  return (
    <List.Item
      icon={iconForKind(child.kind)}
      title={keyLabel}
      subtitle={previewValue(child, 60)}
      accessories={[{ tag: child.kind }, ...(isContainer ? [{ text: String(child.childCount) }] : [])]}
      detail={<LazyItemDetail node={child} pathStr={childPath} />}
      actions={
        <NodeActions
          node={child}
          pathStyle={pathStyle}
          ctx={ctx}
          viewNode={viewNode}
          onDrillIn={isContainer ? onDrillIn : undefined}
        />
      }
    />
  );
}

function NodeActions({
  node,
  pathStyle,
  ctx,
  viewNode,
  onDrillIn,
}: {
  node: ParsedNode;
  pathStyle: PathStyle;
  ctx: NodeViewCtx;
  viewNode?: ParsedNode;
  onDrillIn?: () => void;
}) {
  const { push } = useNavigation();
  const childPath = formatPath(node.path, pathStyle);
  const keyLabel = node.key !== undefined ? String(node.key) : "$";
  const isContainer = node.kind === "object" || node.kind === "array";
  const flatTarget = viewNode ?? node;

  return (
    <ActionPanel>
      {onDrillIn && isContainer && <Action title="Drill In" icon={Icon.ArrowRightCircle} onAction={onDrillIn} />}
      {!isContainer && <Action.CopyToClipboard title="Copy Value" content={stringifyLeaf(node.value)} />}
      <Action
        title="View Current Level as Flat"
        icon={Icon.Eye}
        shortcut={{ modifiers: ["cmd"], key: "d" }}
        onAction={() =>
          push(
            <FlatJsonDetail
              node={flatTarget}
              pathStr={formatPath(flatTarget.path, pathStyle)}
              navigationTitle={`Flat · ${formatPath(flatTarget.path, pathStyle) || "$"}`}
              onEditRequest={ctx.onEditRequest}
            />,
          )
        }
      />
      <Action
        title="Edit Input"
        icon={Icon.Pencil}
        shortcut={{ modifiers: ["cmd"], key: "e" }}
        onAction={ctx.onEditRequest}
      />
      <Action.CopyToClipboard
        title="Copy Pretty"
        content={pretty(node.value)}
        shortcut={{ modifiers: ["cmd"], key: "c" }}
      />
      <Action.CopyToClipboard
        title="Copy Minified"
        content={minified(node.value)}
        shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
      />
      <Action.CopyToClipboard
        title={`Copy Path (${pathStyle})`}
        content={childPath || "$"}
        shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
      />
      <Action.CopyToClipboard
        title="Copy Key"
        content={keyLabel}
        shortcut={{ modifiers: ["cmd", "shift"], key: "k" }}
      />
      <ActionPanel.Submenu title="Copy Path As…" icon={Icon.Link}>
        <Action.CopyToClipboard title="JSON Path" content={formatPath(node.path, "jsonpath") || "$"} />
        <Action.CopyToClipboard title="Bracket Path" content={formatPath(node.path, "bracket")} />
        <Action.CopyToClipboard title="Dot Path" content={formatPath(node.path, "dot")} />
      </ActionPanel.Submenu>
      <HistorySubmenu
        history={ctx.history}
        selectedEntryId={ctx.selectedEntryId}
        onSelectEntry={ctx.onSelectEntry}
        onAfterClear={ctx.onAfterHistoryCleared}
      />
      <ActionPanel.Section title="Document">
        <Action.CopyToClipboard
          title="Copy Whole Document (pretty)"
          content={pretty(ctx.rootValue)}
          shortcut={{ modifiers: ["cmd", "opt"], key: "c" }}
        />
        <Action.CopyToClipboard title="Copy Whole Document (minified)" content={minified(ctx.rootValue)} />
        <Action
          title={ctx.repair ? "Disable Lenient Repair" : "Toggle Lenient Repair"}
          icon={Icon.BandAid}
          shortcut={{ modifiers: ["cmd"], key: "r" }}
          onAction={ctx.onRepairToggle}
        />
        <Action
          title="Re-read Input Source"
          icon={Icon.ArrowClockwise}
          shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
          onAction={() => void ctx.onRefresh()}
        />
      </ActionPanel.Section>
    </ActionPanel>
  );
}

const DETAIL_LIMIT = 10_000;
const FLAT_VIEW_LIMIT = 100_000; // user explicitly requested flat view → allow more

function LazyItemDetail({ node, pathStr }: { node: ParsedNode; pathStr: string }) {
  // buildDetailMarkdown only fires when Raycast actually renders this component
  // (i.e. when its parent List.Item is focused), not for every offscreen item.
  return <List.Item.Detail markdown={buildDetailMarkdown(node, pathStr)} />;
}

function FlatJsonDetail({
  node,
  pathStr,
  navigationTitle,
  onEditRequest,
}: {
  node: ParsedNode;
  pathStr: string;
  navigationTitle: string;
  onEditRequest?: () => void;
}) {
  const { pop } = useNavigation();
  const isContainer = node.kind === "object" || node.kind === "array";
  const valueMaxDepth = useMemo(() => (isContainer ? maxDepthOf(node.value) : 0), [node.value, isContainer]);
  // undefined = fully expanded; n = render only the first n container levels.
  const [foldDepth, setFoldDepth] = useState<number | undefined>(undefined);
  const effectiveDepth = foldDepth ?? valueMaxDepth;

  const { markdown, fullPretty } = useMemo(() => {
    const meta = isContainer
      ? `\`${node.kind}\` · ${node.childCount} ${node.kind === "array" ? "items" : "keys"}`
      : `\`${node.kind}\``;
    const foldHint = isContainer && valueMaxDepth > 1 ? ` · fold ${effectiveDepth}/${valueMaxDepth}` : "";
    const header = `**${pathStr || "$"}** · ${meta}${foldHint}`;
    if (node.kind === "string") {
      const s = node.value as string;
      const { text, truncated } = truncateForPreview(s, FLAT_VIEW_LIMIT);
      return {
        markdown: `${header}\n\n\`\`\`text\n${text}${truncated ? `\n…\n/* showing ${(text.length / 1024).toFixed(1)} KB of ${(s.length / 1024).toFixed(1)} KB */` : ""}\n\`\`\``,
        fullPretty: s,
      };
    }
    const folded = prettyWithFold(node.value, foldDepth, FLAT_VIEW_LIMIT);
    return {
      markdown: `${header}\n\n\`\`\`json\n${folded.text}${folded.truncated ? truncationNote(folded.fullChars, folded.text.length) : ""}\n\`\`\``,
      fullPretty: pretty(node.value),
    };
  }, [node, pathStr, foldDepth, valueMaxDepth, isContainer, effectiveDepth]);

  const canFoldDeeper = isContainer && effectiveDepth > 1;
  const canUnfold = isContainer && foldDepth !== undefined && foldDepth < valueMaxDepth;

  return (
    <Detail
      markdown={markdown}
      navigationTitle={navigationTitle}
      actions={
        <ActionPanel>
          {onEditRequest && (
            <Action
              title="Edit Input"
              icon={Icon.Pencil}
              shortcut={{ modifiers: ["cmd"], key: "e" }}
              onAction={onEditRequest}
            />
          )}
          {canFoldDeeper && (
            <Action
              title="Fold One Level"
              icon={Icon.ChevronUp}
              shortcut={{ modifiers: ["cmd"], key: "[" }}
              onAction={() => setFoldDepth(Math.max(1, effectiveDepth - 1))}
            />
          )}
          {canUnfold && (
            <Action
              title="Unfold One Level"
              icon={Icon.ChevronDown}
              shortcut={{ modifiers: ["cmd"], key: "]" }}
              onAction={() =>
                setFoldDepth((d) => {
                  if (d === undefined) return undefined;
                  const next = d + 1;
                  return next >= valueMaxDepth ? undefined : next;
                })
              }
            />
          )}
          {isContainer && valueMaxDepth > 1 && (
            <Action
              title="Fold All"
              icon={Icon.Minimize}
              shortcut={{ modifiers: ["cmd", "shift"], key: "[" }}
              onAction={() => setFoldDepth(1)}
            />
          )}
          {isContainer && foldDepth !== undefined && (
            <Action
              title="Unfold All"
              icon={Icon.Maximize}
              shortcut={{ modifiers: ["cmd", "shift"], key: "]" }}
              onAction={() => setFoldDepth(undefined)}
            />
          )}
          <Action.CopyToClipboard title="Copy Full Pretty" content={fullPretty} />
          <Action
            title="Back to List View"
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

// Depth-based fold for the flat preview. Editor-style per-key fold isn't
// possible in Raycast's static markdown (no cursor / no click targets), so we
// instead let the user collapse by container depth. A folded container renders
// like `{ /* 5 keys */ }` or `[ /* 12 items */ ]`.
interface FoldedPrettyResult {
  text: string;
  truncated: boolean;
  fullChars: number;
}

function prettyWithFold(value: unknown, maxDepth: number | undefined, maxLen: number): FoldedPrettyResult {
  const full = renderFold(value, maxDepth, 0);
  const fullChars = full.length;
  const { text, truncated } = truncateForPreview(full, maxLen);
  return { text, truncated, fullChars };
}

function renderFold(value: unknown, maxDepth: number | undefined, currentDepth: number): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (maxDepth !== undefined && currentDepth >= maxDepth) {
      return `[ /* ${value.length} item${value.length === 1 ? "" : "s"} */ ]`;
    }
    const parts = value.map((v) => indentRest(renderFold(v, maxDepth, currentDepth + 1)));
    return `[\n  ${parts.join(",\n  ")}\n]`;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return "{}";
    if (maxDepth !== undefined && currentDepth >= maxDepth) {
      return `{ /* ${keys.length} key${keys.length === 1 ? "" : "s"} */ }`;
    }
    const parts = keys.map(
      (k) => `${JSON.stringify(k)}: ${indentRest(renderFold(obj[k], maxDepth, currentDepth + 1))}`,
    );
    return `{\n  ${parts.join(",\n  ")}\n}`;
  }
  return JSON.stringify(value, null, 2);
}

// Pretty parts produced by renderFold already start at column 0; indent every
// non-first line so they nest correctly inside the parent's two-space indent.
function indentRest(s: string): string {
  return s.replace(/\n/g, "\n  ");
}

function maxDepthOf(value: unknown): number {
  if (Array.isArray(value)) {
    if (value.length === 0) return 1;
    let m = 0;
    for (const v of value) m = Math.max(m, maxDepthOf(v));
    return 1 + m;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return 1;
    let m = 0;
    for (const k of keys) m = Math.max(m, maxDepthOf(obj[k]));
    return 1 + m;
  }
  return 0;
}

export function buildDetailMarkdown(node: ParsedNode, pathStr: string): string {
  const meta =
    node.kind === "object" || node.kind === "array"
      ? `\`${node.kind}\` · ${node.childCount} ${node.kind === "array" ? "items" : "keys"}`
      : `\`${node.kind}\``;
  const header = `**${pathStr || "$"}** · ${meta}`;
  if (node.kind === "string") {
    const s = node.value as string;
    const { text, truncated } = truncateForPreview(s, DETAIL_LIMIT);
    return `${header}\n\n\`\`\`text\n${text}${truncated ? truncationNote(s.length, text.length) : ""}\n\`\`\``;
  }
  const prettyText = shallowPretty(node.value, DETAIL_LIMIT);
  return `${header}\n\n\`\`\`json\n${prettyText.text}${prettyText.truncated ? truncationNote(prettyText.full, prettyText.text.length) : ""}\n\`\`\``;
}

function truncationNote(fullSize: number, shownSize: number): string {
  return `\n…\n/* showing ${(shownSize / 1024).toFixed(1)} KB of ${(fullSize / 1024).toFixed(1)} KB — Copy Pretty for full */`;
}

interface ShallowPrettyResult {
  text: string;
  truncated: boolean;
  full: number;
}

function shallowPretty(value: unknown, maxLen: number): ShallowPrettyResult {
  // For arrays/objects, stop stringifying once we hit maxLen so we never
  // build a giant intermediate string for huge inputs.
  if (Array.isArray(value)) {
    let out = "[";
    let i = 0;
    for (; i < value.length; i++) {
      const part = JSON.stringify(value[i], null, 2);
      if (out.length + part.length + 4 > maxLen) break;
      out += (i === 0 ? "\n  " : ",\n  ") + part.replace(/\n/g, "\n  ");
    }
    if (i < value.length) {
      const remaining = value.length - i;
      out += `,\n  /* … ${remaining} more item${remaining === 1 ? "" : "s"} */`;
      out += "\n]";
      return { text: out, truncated: true, full: value.length };
    }
    out += "\n]";
    return { text: out, truncated: false, full: value.length };
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    let out = "{";
    let i = 0;
    for (; i < keys.length; i++) {
      const k = keys[i];
      const part = `${JSON.stringify(k)}: ${JSON.stringify(obj[k], null, 2)}`;
      if (out.length + part.length + 4 > maxLen) break;
      out += (i === 0 ? "\n  " : ",\n  ") + part.replace(/\n/g, "\n  ");
    }
    if (i < keys.length) {
      const remaining = keys.length - i;
      out += `,\n  /* … ${remaining} more key${remaining === 1 ? "" : "s"} */`;
      out += "\n}";
      return { text: out, truncated: true, full: keys.length };
    }
    out += "\n}";
    return { text: out, truncated: false, full: keys.length };
  }
  const full = JSON.stringify(value, null, 2);
  const { text, truncated } = truncateForPreview(full, maxLen);
  return { text, truncated, full: full.length };
}

function stringifyLeaf(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "string") return v;
  return String(v);
}

export function iconForKind(kind: ParsedNode["kind"]) {
  switch (kind) {
    case "object":
      return { source: Icon.CodeBlock, tintColor: Color.Blue };
    case "array":
      return { source: Icon.List, tintColor: Color.Purple };
    case "string":
      return { source: Icon.Text, tintColor: Color.Green };
    case "number":
      return { source: Icon.Hashtag, tintColor: Color.Orange };
    case "boolean":
      return { source: Icon.Switch, tintColor: Color.Yellow };
    case "null":
      return { source: Icon.Circle, tintColor: Color.SecondaryText };
  }
}
