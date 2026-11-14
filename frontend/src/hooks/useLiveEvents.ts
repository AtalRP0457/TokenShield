import { useContext } from 'react';
import { LiveEventsContext, type LiveEventsValue } from './liveEventsContext';

export function useLiveEvents(): LiveEventsValue {
  const ctx = useContext(LiveEventsContext);
  if (!ctx) throw new Error('useLiveEvents must be used inside <LiveEventsProvider>');
  return ctx;
}
