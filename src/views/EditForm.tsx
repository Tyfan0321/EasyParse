import { Action, ActionPanel, Clipboard, Form, Icon, Toast, showToast } from "@raycast/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { execFile } from "child_process";
import { promises as fs, watch as fsWatch, FSWatcher } from "fs";
import { tmpdir } from "os";
import path from "path";
import { normalize } from "../lib/clipboard";
import { parseAuto } from "../parsers";
import { pretty } from "../lib/format";

interface Props {
  initial?: string;
  onSubmit: (text: string, opts?: { repair?: boolean }) => void;
}

export function EditForm({ initial = "", onSubmit }: Props) {
  const [text, setText] = useState(() => prettifyInitial(initial));
  const externalRef = useRef<{ file: string; watcher: FSWatcher } | null>(null);

  const status = useMemo(() => buildStatus(text), [text]);

  // Tear down the file watcher / temp file when the form unmounts.
  useEffect(() => {
    return () => {
      const ext = externalRef.current;
      if (!ext) return;
      try {
        ext.watcher.close();
      } catch {
        /* ignore */
      }
      void fs.unlink(ext.file).catch(() => undefined);
      externalRef.current = null;
    };
  }, []);

  const submit = (repair: boolean) => {
    onSubmit(text, { repair });
  };

  const pasteFromClipboard = async () => {
    const clip = await Clipboard.readText();
    if (clip && clip.trim()) {
      setText(prettifyInitial(normalize(clip)));
    } else {
      await showToast({ style: Toast.Style.Failure, title: "Clipboard is empty" });
    }
  };

  const reformat = () => {
    const next = prettifyInitial(text);
    if (next === text) {
      void showToast({ style: Toast.Style.Success, title: "Already pretty (or unparseable)" });
      return;
    }
    setText(next);
  };

  const openExternally = async () => {
    try {
      // Reuse an existing temp file/watcher if the user opens the editor twice.
      if (!externalRef.current) {
        const file = path.join(tmpdir(), `easy-parse-${Date.now()}.json`);
        await fs.writeFile(file, text, "utf8");
        const watcher = fsWatch(file, { persistent: false }, async (event) => {
          if (event !== "change") return;
          try {
            const next = await fs.readFile(file, "utf8");
            setText(next);
          } catch {
            /* file may have been removed mid-save by the editor; ignore */
          }
        });
        externalRef.current = { file, watcher };
      } else {
        // Sync current buffer to the temp file before reopening.
        await fs.writeFile(externalRef.current.file, text, "utf8");
      }
      await new Promise<void>((resolve, reject) => {
        execFile("open", [externalRef.current!.file], (err) => (err ? reject(err) : resolve()));
      });
      await showToast({
        style: Toast.Style.Success,
        title: "Opened in external editor",
        message: "Save the file and changes flow back here automatically",
      });
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Could not open external editor",
        message: (e as Error).message,
      });
    }
  };

  return (
    <Form
      navigationTitle={`Edit Input — ${status}`}
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
            title="Open in External Editor"
            icon={Icon.AppWindow}
            shortcut={{ modifiers: ["cmd"], key: "o" }}
            onAction={openExternally}
          />
          <Action
            title="Reformat (pretty)"
            icon={Icon.Wand}
            shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
            onAction={reformat}
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
      <Form.TextArea
        id="input"
        placeholder="Paste JSON or JSONL here. Press ⌘O to edit in your default editor."
        value={text}
        onChange={setText}
        autoFocus
      />
    </Form>
  );
}

function prettifyInitial(input: string): string {
  if (!input || !input.trim()) return input;
  const r = parseAuto(input);
  if (!r.ok) return input;
  if (r.format === "jsonl") return input; // multi-line pretty would break the line-delimited invariant
  return pretty(r.root.value);
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
