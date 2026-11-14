import { Link } from 'react-router-dom';
import type { AgentEvent } from '../../types/api';
import { EVENT_TYPE, FALLBACK_EVENT, TONE_CLASSES } from '../../lib/labels';
import { formatInteger, formatTime, formatUsd } from '../../lib/format';
import { cn } from '../ui/cn';

interface EventRowProps {
  event: AgentEvent;
  showAgent?: boolean;
  compact?: boolean;
  isNew?: boolean;
}

export function EventRow({ event, showAgent = true, compact, isNew }: EventRowProps) {
  const meta = EVENT_TYPE[event.type] ?? FALLBACK_EVENT;
  const failed = event.success === false;
  const tone = failed && event.type === 'tool_call' ? 'danger' : meta.tone;
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
              {event.agent_name}
            </Link>
          )}
          <span className={cn('truncate', failed ? 'text-red-300' : 'text-fg-muted')}>{event.message}</span>
        </p>
        {!compact && (
          <p className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[11px] text-fg-subtle">
            <span>{meta.label}</span>
            {event.tool_name && <span>{event.tool_name}</span>}
            {event.tokens != null && <span>{formatInteger(event.tokens)} tok</span>}
            {event.cost_usd != null && <span>{formatUsd(event.cost_usd)}</span>}
            {event.latency_ms != null && <span>{formatInteger(event.latency_ms)} ms</span>}
          </p>
        )}
      </div>
      <time dateTime={event.timestamp} className="shrink-0 font-mono text-[11px] text-fg-subtle tabular-nums">
        {formatTime(event.timestamp)}
      </time>
    </li>
  );
}
