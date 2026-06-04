# Easy Parse

A [Raycast](https://www.raycast.com) extension that turns the JSON / JSONL on your clipboard into a structured, foldable tree — without leaving the keyboard.

## Commands

| Command | What it does |
|---|---|
| **Parse Clipboard** | Reads the current clipboard, auto-detects JSON or JSONL, and opens a list view where each key/line is a foldable item. |
| **Parse Input** | Opens an editor first. Paste or type any JSON / JSONL, then hit `⌘⏎` to parse. Useful when the data isn't on your clipboard. |

## Features

- **Auto-detect** JSON vs JSONL via a fast line probe (no full parse of every line).
- **List + detail pane** main view — each key/line is a row; the right pane lazily renders the focused subtree as highlighted JSON. Stays snappy on 1 MB+ inputs.
- **Drill in** with `↩` on containers, then keep navigating deeper. `⌘D` toggles a flat single-block view of the current level.
- **Lenient repair** on parse errors via [`jsonrepair`](https://github.com/josdejong/jsonrepair) — fixes trailing commas, single quotes, unquoted keys, Python `None/True/False`, smart quotes. Triggered manually with `⌘R`, or auto-enabled via preference.
- **Edit Input** (`⌘E`) anywhere to fix raw text in a form with live validation.
- **Clipboard history** (`⌘⇧H`) — last few successfully-parsed clipboards are stashed in `LocalStorage`. Switch back instantly without re-copying. Configurable size, byte limit, and opt-out.
- **Copy** the pretty/minified value or its JSON Path / bracket / dot path of any node.

## Preferences

| Setting | Default | Notes |
|---|---|---|
| Max input size (bytes) | 5 MB | Inputs larger than this get truncated in previews. |
| Lenient repair | off | Auto-retry parse errors through `jsonrepair`. |
| Path copy format | JSONPath | Or bracket / dot. |
| Clipboard history | on | Cache parsed clipboards across sessions. |
| History size | 5 | 1-50. |
| History entry size (bytes) | 100 KB | Larger payloads skip caching. |

## Local development

```bash
npm install
npm run dev     # registers the commands in your local Raycast in dev mode
npm run lint    # ESLint + Prettier + Raycast manifest check
npm run build   # production build
```

Source layout:

```
src/
├── parse-clipboard.tsx     # entry: read clipboard → ParseResultRouter
├── parse-input.tsx         # entry: open EditForm → ParseResultRouter
├── parsers/                # ParserPlugin registry (json, jsonl, repair, error)
├── detectors/              # format detection (json-shape)
├── lib/                    # tree (lazy), path, format, clipboard, history
├── hooks/                  # useClipboardInput
└── views/                  # JsonNodeView, JsonlDetail, ErrorView, EditForm, …
```

Adding a new format (URL, JWT, Base64, timestamps) means dropping a new `ParserPlugin` into `src/parsers/index.ts` — the UI layer doesn't need to change.

## Credits

Icon glyph derived from [SVG Repo](https://www.svgrepo.com/) (clipboard icon, MIT).
