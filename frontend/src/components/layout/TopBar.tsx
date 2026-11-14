import { Menu } from 'lucide-react';
import { ConnectionIndicator } from './ConnectionIndicator';
import { SimulationControls } from './SimulationControls';
import { Logo } from './Logo';

export function TopBar({ onOpenNav }: { onOpenNav: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-canvas/80 px-4 backdrop-blur-md sm:px-6">
      <button type="button" onClick={onOpenNav} className="-ml-1 rounded-md p-1.5 text-fg-muted hover:bg-surface-2 hover:text-fg lg:hidden" aria-label="Open navigation">
        <Menu className="size-5" />
      </button>
      <div className="lg:hidden">
        <Logo />
      </div>
      <div className="ml-auto flex items-center gap-2.5">
        <ConnectionIndicator />
        <SimulationControls />
      </div>
    </header>
  );
}
