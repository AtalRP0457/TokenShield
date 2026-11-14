import { Sparkles } from 'lucide-react';

/** Gemini's root-cause analysis. Shows a clear placeholder when the backend hasn't generated one. */
export function GeminiExplanation({ text }: { text: string | null }) {
  return (
    <div className="rounded-xl border border-blue-500/20 bg-gradient-to-b from-blue-500/[0.07] to-transparent p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-blue-300" />
        <h3 className="text-sm font-medium text-fg">Gemini analysis</h3>
      </div>
      {text ? (
        <p className="text-sm leading-relaxed text-fg-muted">{text}</p>
      ) : (
        <p className="text-sm text-fg-subtle italic">No explanation has been generated for this incident yet.</p>
      )}
    </div>
  );
}
