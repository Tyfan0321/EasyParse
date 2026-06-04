import { Action, ActionPanel, Clipboard, Form, Icon, Toast, showToast } from "@raycast/api";
import { useMemo, useState } from "react";
import { normalize } from "../lib/clipboard";
import { parseAuto } from "../parsers";

interface Props {
  initial?: string;
  onSubmit: (text: string, opts?: { repair?: boolean }) => void;
}

export function EditForm({ initial = "", onSubmit }: Props) {
  const [text, setText] = useState(initial);

  const status = useMemo(() => buildStatus(text), [text]);

  const submit = (repair: boolean) => {
    onSubmit(text, { repair });
  };

  const pasteFromClipboard = async () => {
    const clip = await Clipboard.readText();
    if (clip && clip.trim()) {
      setText(normalize(clip));
    } else {
      await showToast({ style: Toast.Style.Failure, title: "Clipboard is empty" });
    }
  };

  return (
    <Form
      navigationTitle="Edit Input"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Parse" icon={Icon.MagnifyingGlass} onSubmit={() => submit(false)} />
          <Action.SubmitForm
            title="Parse with Lenient Repair"
            icon={Icon.BandAid}
            shortcut={{ modifiers: ["cmd", "shift"], key: "return" }}
            onSubmit={() => submit(true)}
          />
          <Action
            title="Replace from Clipboard"
            icon={Icon.Clipboard}
            shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
            onAction={pasteFromClipboard}
          />
          <Action
            title="Clear"
            icon={Icon.Trash}
            shortcut={{ modifiers: ["cmd"], key: "l" }}
            onAction={() => setText("")}
          />
          <Action.CopyToClipboard
            title="Copy Current Text"
            content={text}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
        </ActionPanel>
      }
    >
      <Form.Description title="Status" text={status} />
      <Form.TextArea
        id="input"
        title="JSON / JSONL"
        placeholder='Paste JSON or JSONL here. e.g. { "hello": "world" }'
        value={text}
        onChange={setText}
      />
      <Form.Description
        title="Shortcuts"
        text="⌘⏎ Parse   ⌘⇧⏎ Parse with Repair   ⌘⇧V Replace from Clipboard   ⌘L Clear"
      />
    </Form>
  );
}

const LIVE_VALIDATE_LIMIT = 50_000; // ~50 KB — beyond this, skip live parse to stay snappy.

function buildStatus(text: string): string {
  if (!text.trim()) return "Empty — paste or type JSON / JSONL above";
  if (text.length > LIVE_VALIDATE_LIMIT) {
    return `Large input (${(text.length / 1024).toFixed(1)} KB) — submit to parse`;
  }
  const result = parseAuto(text);
  if (result.ok) {
    const lines = result.lines ? ` (${result.lines.length} lines)` : "";
    return `✓ Valid ${result.format.toUpperCase()}${lines}`;
  }
  const where = result.error.line ? ` at line ${result.error.line}, col ${result.error.column}` : "";
  return `✗ Invalid: ${result.error.message}${where}  —  ⌘⇧⏎ tries lenient repair`;
}
