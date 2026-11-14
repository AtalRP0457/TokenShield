import { Sparkles } from 'lucide-react';

/** Gemini's root-cause analysis, framed as the Oracle's reading. */
export function GeminiExplanation({ text }: { text: string | null }) {
  return (
    <div className="rounded-xl border border-bronze/25 bg-bronze/[0.06] p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-bronze" />
        <h3 className="font-display text-sm font-semibold tracking-wide text-fg">The Oracle's reading</h3>
        <span className="text-xs text-fg-subtle">Gemini analysis</span>
      </div>
      {text ? (
        <p className="text-sm leading-relaxed text-fg-muted">{text}</p>
      ) : (
        <p className="text-sm text-fg-subtle italic">The Oracle hasn't spoken yet: no explanation has been generated for this incident.</p>
      )}
    </div>
  );
}
