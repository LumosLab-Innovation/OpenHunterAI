import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setError(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(true);
    }
  }
  return (
    <div>
      <div className="flex min-w-0 items-center gap-3 rounded-lg border border-hairline bg-canvas px-4 py-3">
        <span className="select-none font-mono text-ink-faint">$</span>
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre text-xs leading-6 text-ink">
          {command}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded p-2 text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
          aria-label={copied ? "Copied" : "Copy command"}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      <span role="status" className="sr-only">
        {copied ? "Command copied." : ""}
      </span>
      {error && (
        <p className="mt-1 text-xs text-ink-muted">
          Select and copy the command manually.
        </p>
      )}
    </div>
  );
}
