import { useCallback, useEffect, useState } from "react";
import { readClipboardText } from "../lib/clipboard";

export interface ClipboardInput {
  text: string;
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  setText: (text: string) => void;
}

export function useClipboardInput(): ClipboardInput {
  const [text, setTextRaw] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setTextRaw(await readClipboardText());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setText = useCallback((value: string) => {
    setTextRaw(value);
    setLoading(false);
  }, []);

  return { text, loading, error, refresh, setText };
}
