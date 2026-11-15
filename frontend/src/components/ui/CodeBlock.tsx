import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** A code snippet with a copy button. */
export function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the user can still select the text */
    }
  };
  return (
    <div className="relative">
      <pre aria-label={label} className="overflow-x-auto rounded-lg border border-line bg-canvas p-4 pr-12 font-mono text-xs leading-relaxed text-fg-muted">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copy ${label}`}
        className="absolute top-2 right-2 rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg"
      >
        {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
