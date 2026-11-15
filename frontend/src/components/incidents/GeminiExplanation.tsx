import type { ReactNode } from 'react';
import { Lightbulb, RefreshCw, Sparkles } from 'lucide-react';
import type { GeminiAnalysis } from '../../types/api';
import { formatPercent } from '../../lib/format';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { SeverityBadge } from './IncidentBadges';

interface Props {
  analysis: GeminiAnalysis | null;
  /** Shown as "In plain words" when Gemini hasn't written its own plain explanation. */
  plainFallback?: string;
  /** True while Gemini is expected to still be working on a new incident. */
  pending: boolean;
  analyzing: boolean;
  onAnalyze: () => void;
  analyzeError: string | null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-medium tracking-wide text-fg-subtle uppercase">{title}</h4>
      {children}
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 text-sm text-fg-muted">
      {items.map((it) => (
        <li key={it} className="flex gap-2"><span className="text-bronze">•</span><span>{it}</span></li>
      ))}
    </ul>
  );
}

/** Gemini's analysis (`gemini_analysis`), framed as the Oracle's reading. */
export function GeminiExplanation({ analysis, plainFallback, pending, analyzing, onAnalyze, analyzeError }: Props) {
  const plain = analysis?.plain_explanation || plainFallback;
  return (
    <div className="rounded-xl border border-bronze/25 bg-bronze/[0.06] p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-bronze" />
        <h3 className="font-display text-sm font-semibold tracking-wide text-fg">The Oracle's reading</h3>
        <span className="text-xs text-fg-subtle">Gemini analysis</span>
        {analysis && (
          <span className="ml-auto flex items-center gap-2 text-xs text-fg-muted">
            <SeverityBadge severity={analysis.severity} />
            <span title="Gemini's confidence in this analysis">{formatPercent(analysis.confidence)} confidence</span>
          </span>
        )}
      </div>

      {plain && (
        <div className="mb-4 flex gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-3.5">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-emerald-300" />
          <div>
            <p className="text-xs font-medium tracking-wide text-emerald-300/90 uppercase">In plain words</p>
            <p className="mt-1 text-[15px] leading-relaxed text-fg">{plain}</p>
          </div>
        </div>
      )}

      {analyzing || (pending && !analysis) ? (
        <div className="space-y-2" aria-busy="true">
          <p className="flex items-center gap-2 text-sm text-bronze">
            <Sparkles className="size-3.5 animate-pulse" /> {analyzing ? 'Re-running analysis… this can take up to 30 seconds.' : 'Analyzing… the Oracle usually answers within 10 seconds.'}
          </p>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ) : analysis ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-fg">{analysis.summary}</p>
          <Section title="Why it happened">
            <p className="text-sm leading-relaxed text-fg-muted">{analysis.probable_root_cause}</p>
          </Section>
          {analysis.evidence.length > 0 && <Section title="Evidence"><Bullets items={analysis.evidence} /></Section>}
          {analysis.estimated_wasted_resources && (
            <Section title="Estimated wasted resources">
              <p className="text-sm text-orange-300">{analysis.estimated_wasted_resources}</p>
            </Section>
          )}
          {analysis.additional_investigation.length > 0 && (
            <Section title="Worth investigating"><Bullets items={analysis.additional_investigation} /></Section>
          )}
        </div>
      ) : (
        <p className="text-sm text-fg-subtle">No AI analysis is available for this incident. The detection details below still apply.</p>
      )}

      {!analyzing && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm" variant="ghost" icon={RefreshCw} onClick={onAnalyze} disabled={pending && !analysis}>
            {analysis ? 'Re-run analysis' : 'Run analysis'}
          </Button>
          {analyzeError && <p role="alert" className="text-xs text-red-300">Analysis failed: {analyzeError}</p>}
        </div>
      )}
    </div>
  );
}
