import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { api, config } from '../../services';
import { useApiQuery } from '../../hooks/useApiQuery';
import { cn } from '../ui/cn';
import { Logo } from './Logo';
import { NAV_ITEMS } from './navItems';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  // Small badge with the number of unresolved incidents next to "Incidents".
  const incidents = useApiQuery(() => api.getIncidents(), [], { refreshMs: 5_000 });
  const openIncidents = incidents.data?.filter((i) => i.status !== 'resolved').length ?? 0;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn('fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden', open ? 'opacity-100' : 'pointer-events-none opacity-0')}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-surface transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Logo showTagline />
          <button type="button" onClick={onClose} className="rounded-md p-1 text-fg-subtle hover:text-fg lg:hidden" aria-label="Close navigation">
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-3" aria-label="Main">
          {NAV_ITEMS.map(({ to, label, hint, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                  isActive ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                )
              }
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                <span className="truncate">{label}</span>
                <span className="truncate text-[11px] text-fg-subtle">{hint}</span>
              </span>
              {to === '/incidents' && openIncidents > 0 && (
                <span className="rounded-full bg-red-500/15 px-1.5 py-px font-mono text-[11px] text-red-300">{openIncidents}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line p-4 text-xs text-fg-subtle">
          <p className="mb-3 font-serif text-xs leading-relaxed text-bronze/80 italic">“Tell me, O Muse, of that ingenious hero who travelled far and wide.”</p>
          <p className="font-medium text-fg-muted">{config.useMock ? 'Mock mode' : 'Connected API'}</p>
          <p className="mt-0.5 truncate font-mono" title={config.useMock ? 'In-browser mock data' : config.apiBaseUrl}>
            {config.useMock ? 'in-browser data' : config.apiBaseUrl}
          </p>
        </div>
      </aside>
    </>
  );
}
