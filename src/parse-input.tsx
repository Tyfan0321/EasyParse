import { useState } from "react";
import { getPreferenceValues } from "@raycast/api";
import { ParseResultRouter } from "./views/ParseResultRouter";
import { EditForm } from "./views/EditForm";
import { Preferences } from "./types";

export default function ParseInput() {
  const { autoRepair } = getPreferenceValues<Preferences>();
  const [text, setText] = useState("");
  const [repair, setRepair] = useState<boolean>(autoRepair);
  const [editing, setEditing] = useState(true);

  const handleSubmit = (newText: string, opts?: { repair?: boolean }) => {
    setText(newText);
    if (opts?.repair !== undefined) setRepair(opts.repair);
    setEditing(false);
  };

  if (editing) {
    return <EditForm initial={text} onSubmit={handleSubmit} />;
  }

  return (
    <ParseResultRouter
      text={text}
      source="input"
      repair={repair}
      onRepairToggle={() => setRepair((v) => !v)}
      onEditRequest={() => setEditing(true)}
    />
  );
}
