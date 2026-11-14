/**
 * Chart colours. Categorical slots are a CVD-validated dark-mode palette,
 * assigned in fixed order (never cycled) and keyed to the entity, so an
 * agent keeps its colour when filters change.
 */
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'] as const;

export const CHART = {
  grid: '#232327',
  axis: '#71717a',
  tooltipBg: '#18181b',
  tooltipBorder: '#2e2e33',
  text: '#ededef',
  muted: '#a1a1aa',
  success: '#199e70',
  danger: '#e66767',
  waste: '#d95926',
} as const;

/** Stable colour per agent id: same agent → same colour everywhere. */
export function colorForAgent(agentId: string, orderedIds: string[]): string {
  const idx = orderedIds.indexOf(agentId);
  return idx >= 0 && idx < SERIES.length ? SERIES[idx] : '#71717a';
}
