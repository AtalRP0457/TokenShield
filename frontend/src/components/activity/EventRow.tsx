import { Link } from 'react-router-dom';
import type { AgentEvent } from '../../types/api';
import { displayAgentName, eventMeta, TONE_CLASSES } from '../../lib/labels';
import { formatInteger, formatTime, formatUsd } from '../../lib/format';
import { cn } from '../ui/cn';

interface EventRowProps {
  event: AgentEvent;
  /** Events only carry agent_id; pass the resolved name (or omit to hide). */
  agentName?: string;
  showAgent?: boolean;
  compact?: boolean;
  isNew?: boolean;
}

/** One readable sentence for an event, built from its fields. */
export function describeEvent(e: AgentEvent): string {
  const label = eventMeta(e.event_type).label;
  const subject = e.tool_name ?? label;
  if (e.success === false) return `${subject} failed${e.error_message ? `: ${e.error_message}` : ''}`;
  if (e.event_type === 'tool_call') return `${subject} ${e.success ? 'succeeded' : 'called'}`;
  if (e.total_tokens) return `${label} · ${formatInteger(e.total_tokens)} tokens`;
  return e.tool_name ? `${label}: ${e.tool_name}` : label;
}

export function EventRow({ event, agentName, showAgent = true, compact, isNew }: EventRowProps) {
  const meta = eventMeta(event.event_type);
  const failed = event.success === false;
  const tone = failed ? 'danger' : meta.tone;
  const Icon = meta.icon;

  return (
    <li className={cn('flex items-start gap-3 px-4', compact ? 'py-2' : 'py-2.5', isNew && 'animate-feed-in')}>
      <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset', TONE_CLASSES[tone])}>
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          {showAgent && (
            <Link to={`/agents/${event.agent_id}`} className="font-medium text-fg hover:underline">
              {agentName ? displayAgentName(agentName) : `Agent ${event.agent_id.slice(0, 8)}`}
            </Link>
          )}
          <span className={cn('min-w-0 truncate', failed ? 'text-red-300' : 'text-fg-muted')}>{describeEvent(event)}</span>
        </p>
        {!compact && (
          <p className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[11px] text-fg-subtle">
            <span>{meta.label}</span>
            {event.model && <span>{event.model}</span>}
            {event.total_tokens != null && (
              <span title={event.input_tokens != null ? `${formatInteger(event.input_tokens)} in / ${formatInteger(event.output_tokens ?? 0)} out` : undefined}>
                {formatInteger(event.total_tokens)} tok
              </span>
            )}
            {event.estimated_cost != null && <span>{formatUsd(event.estimated_cost)} est.</span>}
            {event.duration_ms != null && event.duration_ms > 0 && <span>{formatInteger(event.duration_ms)} ms</span>}
          </p>
        )}
      </div>
      <time dateTime={event.timestamp} className="shrink-0 font-mono text-[11px] text-fg-subtle tabular-nums">
        {formatTime(event.timestamp)}
      </time>
    </li>
  );
}
