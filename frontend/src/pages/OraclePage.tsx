import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Loader2, Send, Sparkles } from 'lucide-react';
import type { OracleAnswer } from '../types/api';
import { api } from '../services';
import { useApiQuery } from '../hooks/useApiQuery';
import { displayAgentName } from '../lib/labels';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { cn } from '../components/ui/cn';

const SUGGESTIONS = [
  'Which hero is costing me the most money?',
  'Why was my agent paused?',
  'What problems need my attention right now?',
  'How much has TokenShield saved me?',
  'Explain what a loop is, like I am new to this.',
];

interface Turn {
  id: number;
  question: string;
  answer?: OracleAnswer;
  error?: string;
}

/** Ask the Oracle: plain-language questions about your agents, answered by Gemini. */
export function OraclePage() {
  const agents = useApiQuery(() => api.getAgents(), []);
  const [agentId, setAgentId] = useState('');
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Braces matter: newer Chrome returns a Promise from scrollIntoView, and React would
    // treat any returned value as a cleanup function and crash when you leave the page.
    if (turns.length > 0) bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const id = ++seq.current;
    setTurns((t) => [...t, { id, question: q }]);
    setText('');
    setBusy(true);
    try {
      const answer = await api.askOracle(q, agentId || undefined);
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, answer } : x)));
    } catch (err) {
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, error: err instanceof Error ? err.message : String(err) } : x)));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(text);
  };

  return (
    <>
      <PageHeader
        title="Ask the Oracle"
        description="Ask anything about your agents in everyday words. The Oracle (Gemini) answers in plain English, using only what TokenShield has seen."
        actions={
          <Select
            aria-label="Ask about"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            options={[{ value: '', label: 'All heroes' }, ...(agents.data ?? []).map((a) => ({ value: a.id, label: displayAgentName(a.name) }))]}
            className="w-52"
          />
        }
      />

      <Card className="flex min-h-[460px] flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {turns.length === 0 && (
            <div className="mx-auto max-w-xl py-8 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-bronze/15 text-bronze">
                <Sparkles className="size-6" />
              </span>
              <p className="mt-4 font-display text-lg text-fg">What would you like to know?</p>
              <p className="mt-1 text-sm text-fg-muted">No technical knowledge needed. Try one of these:</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full border border-line-strong bg-surface-2 px-3 py-1.5 text-sm text-fg-muted hover:border-bronze/50 hover:text-fg">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t) => (
            <div key={t.id} className="space-y-3">
              <div className="flex justify-end">
                <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-surface-3 px-4 py-2.5 text-sm text-fg">{t.question}</p>
              </div>
              <div className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-bronze/15 text-bronze">
                  <Sparkles className="size-4" />
                </span>
                <div className="max-w-[85%] min-w-0 rounded-2xl rounded-tl-sm border border-bronze/20 bg-bronze/[0.05] px-4 py-3">
                  {t.answer ? (
                    <>
                      <p className="text-[15px] leading-relaxed text-fg">{t.answer.answer}</p>
                      {t.answer.key_points.length > 0 && (
                        <ul className="mt-2.5 space-y-1 text-sm text-fg-muted">
                          {t.answer.key_points.map((k) => (
                            <li key={k} className="flex gap-2"><span className="text-bronze">•</span><span>{k}</span></li>
                          ))}
                        </ul>
                      )}
                      {t.answer.next_step && (
                        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg">
                          <ArrowRight className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                          <span><span className="text-emerald-300">Next step:</span> {t.answer.next_step}</span>
                        </p>
                      )}
                      <p className="mt-2 text-[11px] text-fg-subtle">
                        {t.answer.source === 'gemini' ? 'Answered by Gemini from your TokenShield data' : 'Quick answer from your TokenShield data (Gemini not used)'}
                      </p>
                    </>
                  ) : t.error ? (
                    <p className="text-sm text-red-300">The Oracle could not answer: {t.error}</p>
                  ) : (
                    <p className="flex items-center gap-2 text-sm text-bronze"><Loader2 className="size-4 animate-spin" /> The Oracle is thinking…</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottom} />
        </div>

        <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-line p-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder="Ask in your own words, e.g. “Is anything wasting money right now?”"
            aria-label="Your question"
            className={cn('h-10 flex-1 rounded-lg border border-line-strong bg-surface-2 px-3.5 text-sm text-fg placeholder:text-fg-subtle focus:border-bronze focus:outline-none')}
          />
          <Button type="submit" variant="primary" icon={Send} disabled={!text.trim() || busy} loading={busy}>Ask</Button>
        </form>
      </Card>
    </>
  );
}
