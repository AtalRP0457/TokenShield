import type { IncidentType } from '../types/api';

/**
 * A plain-English explanation of each peril for people who have never written code.
 * Used when the Oracle (Gemini) hasn't written its own `plain_explanation` yet,
 * and by the demo-mode Oracle.
 */
export const PLAIN: Record<IncidentType, { what: string; analogy: string; fix: string }> = {
  REPEATED_TOOL_CALL: {
    what: 'The agent kept asking for the exact same thing over and over, even though it never worked.',
    analogy: "It's like redialling a busy phone number 50 times in a row instead of trying again later.",
    fix: 'Limit how many times it may retry the same step, and make it wait or try something different.',
  },
  SEQUENCE_LOOP: {
    what: 'The agent went round in circles: step A led to step B, which sent it back to step A.',
    analogy: "It's like driving around a roundabout and never taking an exit.",
    fix: 'Give it a maximum number of steps per task so it gives up instead of circling forever.',
  },
  CONSECUTIVE_FAILURES: {
    what: 'Something the agent depends on kept failing, and the agent kept trying anyway.',
    analogy: "It's like pushing a door that's locked, again and again, instead of finding the key.",
    fix: 'Check the service that is failing, and make the agent pause after a few failures.',
  },
  TOKEN_BUDGET_EXCEEDED: {
    what: 'One task used far more text (tokens) than allowed. Tokens are what AI providers charge for.',
    analogy: "It's like photocopying a whole book when you only needed one page.",
    fix: 'Send the AI only the parts it needs, and keep a token budget per task.',
  },
  COST_BUDGET_EXCEEDED: {
    what: 'One task spent more money than its budget allows.',
    analogy: "It's like a shopping trip that goes over the amount you set aside.",
    fix: 'Set a lower budget for this hero, or use a cheaper AI model for simple steps.',
  },
  HIGH_SPENDING: {
    what: 'The agent suddenly started spending much faster than it normally does.',
    analogy: "It's like a tap left running at full blast.",
    fix: 'Look at what changed in the last few minutes and set a budget so it pauses automatically.',
  },
  LONG_RUNNING_TASK: {
    what: 'A task has been running much longer than it should and is probably stuck.',
    analogy: "It's like waiting on hold for an hour with no one coming back.",
    fix: 'Give tasks a time limit, and check where this one got stuck.',
  },
};

export function plainFor(type: string) {
  return PLAIN[type as IncidentType] ?? {
    what: 'TokenShield noticed this agent behaving in a way that wastes money or time.',
    analogy: '',
    fix: 'Open the details to see what happened, then resume the agent once it is fixed.',
  };
}

/** One paragraph a beginner can read. */
export function plainSentence(type: string) {
  const p = plainFor(type);
  return [p.what, p.analogy].filter(Boolean).join(' ');
}
