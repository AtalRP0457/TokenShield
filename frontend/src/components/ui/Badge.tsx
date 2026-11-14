import type { ReactNode } from 'react';
import { TONE_CLASSES, TONE_DOT, type Tone } from '../../lib/labels';
import { cn } from './cn';

interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', dot, pulse, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot && (
        <span className="relative flex size-1.5">
          {pulse && <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-60', TONE_DOT[tone])} />}
          <span className={cn('relative inline-flex size-1.5 rounded-full', TONE_DOT[tone])} />
        </span>
      )}
      {children}
    </span>
  );
}
